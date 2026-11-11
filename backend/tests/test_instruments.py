import json

import numpy as np
import pytest

from app.domain.instruments import stem_label, summarize

pytest.importorskip("librosa")


def win(start, scores):
    return {"start": start, "end": start + 6, "scores": scores}


def test_summarize_translates_groups_and_keeps_spans():
    windows = [win(0, {"Violin, fiddle": 0.6, "Cello": 0.3, "Music": 0.9}), win(6, {"Violin, fiddle": 0.5, "Bowed string instrument": 0.4}),
               win(12, {"Trumpet": 0.2}), win(18, {"Speech": 0.8})]
    out = summarize(windows)
    names = [e["name"] for e in out]
    assert names[0] == "violín" and "chelo" in names and "trompeta" in names
    assert "cuerda frotada" not in names  # el genérico se descarta si hay uno concreto
    assert out[0]["spans"] == [[0, 12]] and out[0]["icon"] == "🎻"
    assert all(e["name"] != "Speech" for e in out)  # lo no musical no cuenta


def test_stem_label_names_by_content():
    strings = summarize([win(0, {"Violin, fiddle": 0.7, "Cello": 0.5})] * 3)
    assert stem_label("other", strings) == "Cuerdas frotadas: violín, chelo"
    assert stem_label("guitar", []) == "Guitarra"


def test_fixed_stems_keep_their_identity():
    """La pista de Demucs manda: el clasificador matiza, no contradice salvo que algo domine."""
    weak_guitar = summarize([win(0, {"Guitar": 0.15, "Plucked string instrument": 0.14})] + [win(6, {"Music": 0.7})] * 5)
    assert stem_label("piano", weak_guitar) == "Piano"
    electric = summarize([win(0, {"Electric guitar": 0.6, "Guitar": 0.5})] * 3)
    assert [e["name"] for e in electric] == ["guitarra eléctrica"] and stem_label("guitar", electric) == "Guitarra: guitarra eléctrica"
    flute = summarize([win(0, {"Flute": 0.9})] * 4)
    assert stem_label("vocals", flute) == "Voz (suena a flauta)"
    assert stem_label("drums", summarize([win(0, {"Drum kit": 0.5, "Snare drum": 0.4})] * 3)) == "Batería"


def test_song_instruments_come_from_active_stems():
    from app.domain.instruments import song_instruments
    stems = [{"id": "piano", "active": True, "activity": {"spans": [[0, 30]], "active_ratio": 0.9}, "instruments": []},
             {"id": "guitar", "active": False, "instruments": []},
             {"id": "other", "active": True, "instruments": summarize([win(0, {"Violin, fiddle": 0.8})] * 2)},
             {"id": "mezcla", "active": True, "instruments": []}]
    assert [e["name"] for e in song_instruments(stems)] == ["piano", "violín"]


def test_empty_stems_are_hidden_and_others_renamed(tmp_path, monkeypatch):
    """Canción simulada ya separada: «guitar» casi vacía y «other» con cuerdas."""
    import soundfile as sf

    from app.application import stems_service as svc
    from app.infrastructure import instrument_tagger
    monkeypatch.setattr(svc, "ROOT", tmp_path)
    sr = 22050
    t = np.arange(sr * 8) / sr
    folder = tmp_path / "abc123"
    (folder / "sep").mkdir(parents=True)
    sf.write(folder / "original.wav", 0.5 * np.sin(2 * np.pi * 220 * t), sr)
    sf.write(folder / "sep" / "other.wav", 0.4 * np.sin(2 * np.pi * 440 * t), sr)
    sf.write(folder / "sep" / "guitar.wav", 0.0005 * np.random.default_rng(0).normal(size=len(t)), sr)
    meta = {"id": "abc123", "stems": [{"id": "guitar", "name": "Guitarra", "file": "sep/guitar.wav"},
                                      {"id": "other", "name": "Otros", "file": "sep/other.wav"},
                                      {"id": "mezcla", "name": "Mezcla original", "file": "original.wav"}]}
    (folder / "meta.json").write_text(json.dumps(meta))
    monkeypatch.setattr(instrument_tagger, "available", lambda: True)
    monkeypatch.setattr(instrument_tagger, "tag_windows", lambda path: [win(0, {"Violin, fiddle": 0.8, "String section": 0.5})] * 2)
    out = svc._detect_instruments("abc123")
    by_id = {s["id"]: s for s in out["stems"]}
    assert by_id["guitar"]["active"] is False
    assert by_id["other"]["active"] is True and by_id["other"]["name"].startswith("Cuerdas frotadas")
    assert [s["id"] for s in out["stems"]][-1] == "mezcla" and out["stems"][-2]["id"] == "guitar"
    assert out["instruments"][0]["name"] == "violín"
