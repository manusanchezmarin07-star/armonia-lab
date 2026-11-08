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
