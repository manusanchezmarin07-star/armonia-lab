from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_identify():
    r = client.post("/api/chords/identify", json={"notes": [55, 59, 62, 65], "key": "C"})
    assert r.status_code == 200
    assert r.json()["readings"][0]["symbol"] == "G7"
    assert r.json()["readings"][0]["analysis"]["roman"] == "V7"


def test_bad_symbol_is_422():
    assert client.get("/api/chords/parse", params={"symbol": "Hmaj7"}).status_code == 422


def test_modulation_and_scales():
    assert client.post("/api/modulation", json={"from_key": "C", "to_key": "Eb"}).json()["routes"]
    assert len(client.get("/api/scales").json()) > 20
    assert client.get("/api/scales/dorian", params={"tonic": "D"}).json()["notes"][0] == "D"


def test_progression_endpoints():
    r = client.post("/api/progression/analyze", json={"text": "Dm7 G7 Cmaj7"})
    assert r.json()["key"] == "C mayor"
    r = client.post("/api/progression/negative", json={"text": "G7 C", "key": "C"})
    assert r.json()["pairs"][0]["negative"] == "Dm7b5"


def test_bach_chorale():
    lst = client.get("/api/bach/chorales").json()
    assert len(lst) > 150
    d = client.get("/api/bach/chorales/bwv66.6").json()
    assert d["key"] == "F#m" and len(d["voices"]) == 4
    named = [c for c in d["chords"] if c["symbol"]]
    assert len(named) / len(d["chords"]) > 0.7
    assert d["musicxml"].lstrip().startswith("<?xml")
