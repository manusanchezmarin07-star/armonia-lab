"""Modo canción: que el proceso completo aguante fallos reales (Demucs que revienta,
descargas colgadas, app cerrada a medias) y que las pistas se empaqueten bien."""
import json
import shutil
import time

import numpy as np
import pytest

pytest.importorskip("librosa")
sf = pytest.importorskip("soundfile")

from tests.audio_fixture import write_progression  # noqa: E402

CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]


def _wait(svc, job_id, seconds=60):
    for _ in range(seconds * 4):
        meta = svc.load(job_id)
        if meta["status"] in ("listo", "error"):
            return meta
        time.sleep(0.25)
    raise AssertionError("el trabajo no terminó: " + meta["status"])


@pytest.fixture
def svc(tmp_path, monkeypatch):
    from app.application import stems_service
    monkeypatch.setattr(stems_service, "ROOT", tmp_path)
    return stems_service


def test_silence_is_not_a_chord(tmp_path):
    """Un silencio al principio y al final no puede salir como acorde."""
    from app.infrastructure import audio_analysis
    path = write_progression(tmp_path / "s.wav", CHORDS)
    y, sr = sf.read(path)
    pad = np.zeros(int(sr * 3))
    sf.write(tmp_path / "pad.wav", np.concatenate([pad, y, pad]), sr)
    segs = audio_analysis.analyze([str(tmp_path / "pad.wav")])["segments"]
    assert segs[0]["symbol"] == "N" and segs[0]["end"] >= 2.0
    assert segs[-1]["symbol"] == "N"
    heard = [s["symbol"] for s in segs if s["symbol"] != "N"]
    assert heard[0].startswith("C") and heard[1].startswith("Am")  # lo de en medio se sigue detectando


def test_multitrack_keeps_each_stem_in_its_own_channels(tmp_path):
    from app.infrastructure import audio_io
    sr = audio_io.SR
    t = np.arange(sr * 2) / sr
    for name, f in (("a", 220.0), ("b", 550.0)):
        sf.write(tmp_path / f"{name}.wav", 0.4 * np.sin(2 * np.pi * f * t), sr)
    info = audio_io.write_multitrack([tmp_path / "a.wav", tmp_path / "b.wav"], tmp_path / "m.ogg")
    data, _ = sf.read(tmp_path / "m.ogg")
    # Más de 8 canales para que Vorbis no acople pistas entre sí.
    assert info["channels"] == data.shape[1] >= 10

    def peak_hz(ch):
        spec = np.abs(np.fft.rfft(data[:sr, ch]))
        return np.argmax(spec) * sr / sr
    assert abs(peak_hz(0) - 220) < 3 and abs(peak_hz(1) - 220) < 3
    assert abs(peak_hz(2) - 550) < 3 and abs(peak_hz(3) - 550) < 3
    assert np.abs(data[:, 4:]).max() < 1e-3  # el resto, silencio


def test_unreadable_format_without_ffmpeg_explains_what_to_do(tmp_path, monkeypatch):
    from app.infrastructure import audio_io
    monkeypatch.setattr(audio_io, "ffmpeg", lambda: None)
    f = tmp_path / "cancion.m4a"
    f.write_bytes(b"no soy audio")
    with pytest.raises(ValueError, match="ffmpeg"):
        audio_io.normalize(f)


def test_worker_is_killed_when_it_hangs():
    """Un proceso hijo que no termina (descarga colgada) se cancela al pasar el límite."""
    from app.infrastructure.separation import run_worker
    t0 = time.time()
    with pytest.raises(RuntimeError, match="límite"):
        run_worker("http.server", ["0"], timeout=1.5)  # un servidor: no acaba nunca
    assert time.time() - t0 < 10


def test_song_with_stems_is_ready_before_instruments_and_has_multitrack(tmp_path, svc, monkeypatch):
    from app.infrastructure import separation
    src = write_progression(tmp_path / "song.wav", CHORDS)

    def fake_separate(audio, out_dir, model, on_progress=None):
        out_dir.mkdir(parents=True, exist_ok=True)
        if on_progress:
            on_progress(0.5)
        stems = {}
        for name in ("bass", "other", "vocals"):
            shutil.copy(audio, out_dir / f"{name}.wav")
            stems[name] = out_dir / f"{name}.wav"
        return stems
    monkeypatch.setattr(separation, "demucs_available", lambda: True)
    monkeypatch.setattr(separation, "separate", fake_separate)
    job = svc.create("song.wav", open(src, "rb").read(), "htdemucs_6s")
    meta = _wait(svc, job["id"])
    assert meta["status"] == "listo" and meta["separated"] and not meta.get("warning")
    assert [x["id"] for x in meta["multitrack"]["layout"]] == ["bass", "other", "vocals"]
    assert meta["multitrack"]["layout"][1]["channels"] == [2, 3]
    assert svc.multitrack_path(job["id"]).exists()
    assert {i["name"] for i in meta["instruments"]} >= {"bajo", "voz"}  # sin clasificador: salen de las pistas


def test_demucs_failure_still_gives_chords_from_the_mix(tmp_path, svc, monkeypatch):
    from app.infrastructure import separation
    src = write_progression(tmp_path / "song.wav", CHORDS)

    def boom(*a, **kw):
        raise RuntimeError("CUDA out of memory")
    monkeypatch.setattr(separation, "demucs_available", lambda: True)
    monkeypatch.setattr(separation, "separate", boom)
    meta = _wait(svc, svc.create("song.wav", open(src, "rb").read(), "htdemucs_6s")["id"])
    assert meta["status"] == "listo" and not meta["separated"]
    assert "CUDA out of memory" in meta["warning"]
    assert meta["analysis"]["segments"][0]["symbol"] == "C"
    with pytest.raises(KeyError):
        svc.multitrack_path(meta["id"])


def test_interrupted_jobs_are_recovered_and_can_be_retried(tmp_path, svc):
    src = write_progression(tmp_path / "song.wav", CHORDS)
    folder = tmp_path / "abc123"
    folder.mkdir()
    shutil.copy(src, folder / "original.wav")
    meta = {"id": "abc123", "title": "x", "status": "separando pistas", "progress": 0.3, "message": "", "model": None,
            "separated": False, "stems": [], "analysis": None, "original": "original.wav"}
    (folder / "meta.json").write_text(json.dumps(meta))
    assert svc.recover_interrupted() == 1
    assert svc.load("abc123")["status"] == "error" and "Reintentar" in svc.load("abc123")["message"]
    svc.retry("abc123")
    done = _wait(svc, "abc123")
    assert done["status"] == "listo" and done["analysis"]["segments"]


def test_old_separated_jobs_get_a_multitrack_on_demand(tmp_path, svc):
    """Canciones separadas con versiones anteriores: no tienen multipista; se crea al pedirlo."""
    src = write_progression(tmp_path / "song.wav", CHORDS)
    folder = tmp_path / "old1"
    (folder / "sep").mkdir(parents=True)
    for n in ("original.wav", "sep/piano.wav", "sep/bass.wav"):
        shutil.copy(src, folder / n)
    meta = {"id": "old1", "title": "x", "status": "listo", "separated": True, "analysis": {"segments": []},
            "stems": [{"id": "bass", "name": "Bajo", "file": "sep/bass.wav"}, {"id": "piano", "name": "Piano", "file": "sep/piano.wav"},
                      {"id": "mezcla", "name": "Mezcla original", "file": "original.wav"}]}
    (folder / "meta.json").write_text(json.dumps(meta))
    assert svc.multitrack_path("old1").name == "multipista.ogg"
    assert [x["id"] for x in svc.load("old1")["multitrack"]["layout"]] == ["bass", "piano"]


@pytest.mark.parametrize("url,ok", [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", True), ("youtu.be/dQw4w9WgXcQ", True),
    ("https://music.youtube.com/watch?v=abc&list=xyz", True), ("https://www.youtube.com/shorts/abc123", True),
    ("https://www.youtube.com/playlist?list=PL123", False), ("https://www.youtube.com/@canal", False),
    ("https://vimeo.com/123", False), ("http://127.0.0.1:8765/api/health", False), ("file:///etc/passwd", False),
    ("https://youtube.com.evil.example/watch?v=x", False), ("", False),
])
def test_only_youtube_video_links_are_accepted(url, ok):
    from app.infrastructure import youtube
    if ok:
        assert youtube.check_url(url).startswith("http")
    else:
        with pytest.raises(ValueError):
            youtube.check_url(url)


def test_youtube_import_runs_the_normal_pipeline(tmp_path, svc, monkeypatch):
    """La descarga se simula: lo que se comprueba es que el audio bajado sigue el flujo normal."""
    from app.infrastructure import youtube
    src = write_progression(tmp_path / "song.wav", CHORDS)

    def fake_fetch(url, folder, on_progress=None):
        shutil.copy(src, folder / "original.wav")
        if on_progress:
            on_progress(1.0)
        return folder / "original.wav", {"title": "Canción de prueba", "uploader": "Canal", "duration": 8, "url": url}
    monkeypatch.setattr(youtube, "available", lambda: True)
    monkeypatch.setattr(youtube, "fetch", fake_fetch)
    job = svc.create_from_url("https://youtu.be/abc123", "htdemucs_6s", separate=False)
    meta = _wait(svc, job["id"])
    assert meta["status"] == "listo" and meta["title"] == "Canción de prueba"
    assert meta["source"]["kind"] == "youtube" and meta["source"]["uploader"] == "Canal"
    assert meta["analysis"]["segments"][0]["symbol"].startswith("C")


def test_youtube_download_error_is_shown_and_can_be_retried(tmp_path, svc, monkeypatch):
    from app.infrastructure import youtube

    def boom(url, folder, on_progress=None):
        raise RuntimeError("No se pudo descargar el vídeo: Video unavailable")
    monkeypatch.setattr(youtube, "available", lambda: True)
    monkeypatch.setattr(youtube, "fetch", boom)
    meta = _wait(svc, svc.create_from_url("https://youtu.be/abc123", "htdemucs_6s", separate=False)["id"])
    assert meta["status"] == "error" and "Video unavailable" in meta["message"]
    with pytest.raises(ValueError):
        svc.create_from_url("https://example.com/video", "htdemucs_6s")
