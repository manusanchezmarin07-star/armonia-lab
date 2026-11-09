"""Fuzzing de la API: con entradas arbitrarias ningún endpoint puede devolver 500.

Hypothesis genera textos, números y estructuras raras (vacíos, unicode, símbolos de
acordes mal escritos, tonalidades inexistentes…). Un 4xx con mensaje es correcto;
un 5xx es un bug.
"""
from urllib.parse import quote

from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from app.main import app

client = TestClient(app, raise_server_exceptions=False)

# Textos que parecen música (más probabilidad de llegar lejos en el código) mezclados con basura.
chordish = st.from_regex(r"[A-Ga-h][#b♭♯]{0,2}(m|maj7|7|dim|ø|°7|sus4|m7b5|13|7\(b9,#11\)|add9|/[A-G]|\(|\)|,| ){0,4}", fullmatch=True)
text = st.one_of(chordish, st.text(max_size=40), st.just(""), st.just("   "), st.just("C" * 300))
keyish = st.one_of(st.sampled_from(["C", "Am", "F#", "Bbm", "Cb", "E#m", "H", "", "c", "do", "Xm", "C mayor"]), st.text(max_size=8))
ints = st.integers(-10_000, 10_000)
notes = st.lists(st.integers(-50, 200), max_size=25)

SETTINGS = settings(max_examples=int(__import__("os").environ.get("FUZZ_EXAMPLES", "60")), deadline=None, suppress_health_check=[HealthCheck.too_slow])


def ok(r):
    assert r.status_code < 500, (r.request.method, str(r.request.url), r.status_code, r.text[:300])


@SETTINGS
@given(notes, st.one_of(st.none(), keyish))
def test_identify(n, key):
    ok(client.post("/api/chords/identify", json={"notes": n, "key": key}))


@SETTINGS
@given(text, st.one_of(st.none(), keyish))
def test_parse_and_scales_and_hands(sym, key):
    ok(client.get("/api/chords/parse", params={"symbol": sym, **({"key": key} if key is not None else {})}))
    ok(client.get("/api/chords/scales", params={"symbol": sym}))
    ok(client.get("/api/chords/hands", params={"symbol": sym, "style": "basico", "inversion": 0}))


@SETTINGS
@given(text, text)
def test_transition(a, b):
    ok(client.post("/api/chords/transition", json={"from_chord": a, "to_chord": b}))


@SETTINGS
@given(keyish, keyish)
def test_modulation_and_diatonic(a, b):
    ok(client.post("/api/modulation", json={"from_key": a, "to_key": b}))
    ok(client.get(f"/api/keys/{quote(a or 'C', safe='')}/diatonic"))


@SETTINGS
@given(st.text(max_size=20), keyish)
def test_scale(scale_id, tonic):
    ok(client.get(f"/api/scales/{quote(scale_id or 'x', safe='')}", params={"tonic": tonic}))


@SETTINGS
@given(text, st.one_of(st.none(), keyish))
def test_progressions(t, key):
    ok(client.post("/api/progression/analyze", json={"text": t, "key": key}))
    ok(client.post("/api/progression/negative", json={"text": t, "key": key}))


@SETTINGS
@given(text, st.one_of(st.none(), ints), st.one_of(st.none(), keyish), st.one_of(st.none(), keyish))
def test_transpose(t, n, a, b):
    ok(client.post("/api/progression/transpose", json={"text": t, "semitones": n, "from_key": a, "to_key": b}))


@SETTINGS
@given(text, keyish, st.one_of(st.none(), text), st.one_of(st.none(), text), st.sampled_from(["jazz", "negativa", "gospel", "x"]))
def test_reharm(chord, key, nxt, mel, style):
    ok(client.post("/api/reharm/substitutes", json={"chord": chord, "key": key, "next_chord": nxt, "melody": mel}))
    ok(client.post("/api/reharm/melody", json={"note": chord, "key": key}))
    ok(client.post("/api/reharm/progression", json={"text": chord, "key": key, "style": style}))


@SETTINGS
@given(text, st.sampled_from(["basico", "jazz", "abierto", "otro"]), ints)
def test_hands_any_style_and_inversion(sym, style, inv):
    ok(client.get("/api/chords/hands", params={"symbol": sym, "style": style, "inversion": inv}))


@SETTINGS
@given(st.lists(st.fixed_dictionaries({"role": st.sampled_from(["user", "assistant"]), "content": st.text(max_size=200)}), max_size=5))
def test_assistant(messages):
    ok(client.post("/api/assistant/chat", json={"messages": messages}))


def test_unknown_resources_are_404_not_500():
    for url in ["/api/stems/noexiste", "/api/stems/../../etc/passwd", "/api/stems/abc/audio/vocals", "/api/stems/abc/sheet",
                "/api/stems/abc/arrangement", "/api/bach/chorales/bwv999.9", "/api/bach/chorales/..%2F..%2Fsecret"]:
        ok(client.get(url))
    ok(client.put("/api/stems/abc/segments/0", json={"symbol": "C"}))
    ok(client.delete("/api/library/noexiste"))
