import numpy as np
import pytest

librosa = pytest.importorskip("librosa")

from app.infrastructure.audio_analysis import analyze  # noqa: E402
from tests.audio_fixture import write_progression  # noqa: E402


def test_detects_simple_progression(tmp_path):
    # C – Am – F – G7, dos segundos cada uno.
    path = write_progression(tmp_path / "prog.wav", [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62, 65]])
    res = analyze([str(path)])
    syms = [s["symbol"].split("/")[0] for s in res["segments"] if s["end"] - s["start"] > 0.6]
    assert syms[:4] == ["C", "Am", "F", "G7"], syms
    assert res["key"] in ("C", "Am")


def test_upload_analyze_and_correct_with_midi(tmp_path):
    import time

    from fastapi.testclient import TestClient

    from app.main import app
    client = TestClient(app)
    path = write_progression(tmp_path / "song.wav", [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62, 65]])
    with open(path, "rb") as f:
        job = client.post("/api/stems", files={"file": ("song.wav", f, "audio/wav")}, data={"separate": "false"}).json()
    for _ in range(120):
        meta = client.get(f"/api/stems/{job['id']}").json()
        if meta["status"] in ("listo", "error"):
            break
        time.sleep(0.25)
    assert meta["status"] == "listo", meta["message"]
    assert meta["stems"][-1]["id"] == "mezcla"
    assert client.get(f"/api/stems/{job['id']}/audio/mezcla").status_code == 200
    # Corrección tocando Fmaj7 en el MIDI sobre el tercer acorde.
    meta = client.put(f"/api/stems/{job['id']}/segments/2", json={"notes": [53, 57, 60, 64]}).json()
    assert meta["analysis"]["segments"][2]["symbol"] == "Fmaj7"
    assert meta["analysis"]["segments"][2]["edited"] is True
    assert "Fmaj7" in client.get(f"/api/stems/{job['id']}/progression").json()["text"]
    assert client.delete(f"/api/stems/{job['id']}").status_code == 200


def test_detector_accuracy_does_not_regress():
    """Umbrales medidos con el banco de pruebas (tests/chord_bench.py) sobre canciones sintéticas
    con inversiones, arpegios, bajo, batería y desafinación. Si baja, algo se ha roto."""
    from tests.chord_bench import run
    res = run(n=4, offset=900)
    assert res["pistas.exacto"] >= 75, res
    assert res["pistas.raiz"] >= 85, res
    assert res["mezcla.mayor_menor"] >= 80, res


def test_segments_offer_alternatives(tmp_path):
    path = write_progression(tmp_path / "alt.wav", [[60, 64, 67], [57, 60, 64]])
    segs = analyze([str(path)])["segments"]
    assert all(len(s["alternatives"]) >= 2 for s in segs if s["symbol"] != "N")


def test_vocal_phrases_detects_sung_spans(tmp_path):
    import numpy as np
    import soundfile as sf
    sr = 22050
    y = np.zeros(sr * 6)
    for a, b in ((0.5, 2.0), (3.0, 4.5)):  # dos frases con silencio entre medias
        t = np.arange(int((b - a) * sr)) / sr
        y[int(a * sr):int(a * sr) + len(t)] = 0.5 * np.sin(2 * np.pi * 220 * t)
    p = tmp_path / "voz.wav"
    sf.write(p, y, sr)
    from app.infrastructure.audio_analysis import vocal_phrases
    ph = vocal_phrases(str(p))
    assert len(ph) == 2
    assert abs(ph[0][0] - 0.5) < 0.1 and abs(ph[1][1] - 4.5) < 0.1


def test_lyrics_flow_with_fake_whisper(tmp_path, monkeypatch):
    """Transcripción (Whisper simulado) → letra pegada alineada → hoja con acordes → validar."""
    import time

    from fastapi.testclient import TestClient

    from app.infrastructure import lyrics_asr
    from app.main import app
    monkeypatch.setattr(lyrics_asr, "available", lambda: True)
    monkeypatch.setattr(lyrics_asr, "transcribe", lambda path, language=None: [
        {"start": 0.1, "end": 3.5, "words": [{"word": " hola", "start": 0.1, "end": 0.6}, {"word": " amor", "start": 2.1, "end": 2.6}]},
        {"start": 4.1, "end": 7.0, "words": [{"word": " vuelve", "start": 4.1, "end": 4.6}, {"word": " ya", "start": 6.1, "end": 6.5}]}])
    client = TestClient(app)
    path = write_progression(tmp_path / "s.wav", [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62, 65]])
    with open(path, "rb") as f:
        job = client.post("/api/stems", files={"file": ("s.wav", f, "audio/wav")}, data={"separate": "false"}).json()
    for _ in range(120):
        meta = client.get(f"/api/stems/{job['id']}").json()
        if meta["status"] in ("listo", "error"):
            break
        time.sleep(0.25)
    assert meta["status"] == "listo"
    client.post(f"/api/stems/{job['id']}/lyrics/transcribe")
    for _ in range(40):
        meta = client.get(f"/api/stems/{job['id']}").json()
        if meta.get("lyrics_status") == "listo":
            break
        time.sleep(0.1)
    assert meta["lyrics"]["source"] == "transcripción automática"
    meta = client.put(f"/api/stems/{job['id']}/lyrics", json={"text": "Hola, amor\nvuelve ya"}).json()
    assert meta["lyrics"]["lines"][1]["words"][0] == {"text": "vuelve", "start": 4.1, "end": 4.6}
    sheet = client.get(f"/api/stems/{job['id']}/sheet").json()
    verses = [r for r in sheet if r["type"] == "verse"]
    assert verses[0]["words"][0]["chord"]["symbol"] == "C"
    assert client.put(f"/api/stems/{job['id']}/validated", json={"validated": True}).json()["validated"] is True
    client.delete(f"/api/stems/{job['id']}")


def test_realistic_benchmark_with_sampled_instruments():
    """Banco realista (piano, cuerdas, guitarra, órgano, bajo y batería sampleados con
    FluidSynth). Solo se ejecuta donde hay fluidsynth, el banco FluidR3 y pretty_midi."""
    pytest.importorskip("pretty_midi")
    from tests import chord_bench_real
    if not chord_bench_real.available():
        pytest.skip("fluidsynth o FluidR3_GM.sf2 no disponibles")
    res = chord_bench_real.run(n=3, offset=700)
    assert res["pistas.exacto"] >= 75, res
    assert res["mezcla.raiz"] >= 75, res


def test_background_job_does_not_overwrite_user_corrections(tmp_path, monkeypatch):
    """Mientras se reconocen los instrumentos (en segundo plano) el usuario corrige un acorde:
    la corrección no puede perderse cuando el trabajo de fondo guarda sus resultados."""
    import json
    import threading
    import time

    import soundfile as sf

    from app.application import stems_service as svc
    from app.infrastructure import instrument_tagger
    monkeypatch.setattr(svc, "ROOT", tmp_path)
    folder = tmp_path / "job1"
    folder.mkdir()
    sr = 22050
    sf.write(folder / "original.wav", 0.3 * np.sin(2 * np.pi * 220 * np.arange(sr * 3) / sr), sr)
    meta = {"id": "job1", "stems": [{"id": "mezcla", "name": "Mezcla original", "file": "original.wav"}],
            "analysis": {"duration": 3, "key": "C", "segments": [{"start": 0, "end": 3, "symbol": "C", "pcs": [0, 4, 7],
                                                                  "confidence": 0.5, "edited": False}]}}
    (folder / "meta.json").write_text(json.dumps(meta))
    started = threading.Event()

    def slow_tag(path):
        started.set()
        time.sleep(0.6)  # el clasificador tarda: da tiempo a que el usuario edite
        return []
    monkeypatch.setattr(instrument_tagger, "available", lambda: True)
    monkeypatch.setattr(instrument_tagger, "tag_windows", slow_tag)
    th = threading.Thread(target=svc._detect_instruments, args=("job1",))
    th.start()
    started.wait(2)
    svc.correct_segment("job1", 0, "Am", None)
    th.join()
    assert svc.load("job1")["analysis"]["segments"][0]["symbol"] == "Am"
