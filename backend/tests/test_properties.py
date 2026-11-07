"""Tests de propiedades: invariantes musicales que deben cumplirse para CUALQUIER
entrada (Hypothesis genera cientos de casos aleatorios y busca contraejemplos)."""
from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain.analysis import analyze_progression, negative_progression
from app.domain.chords import _SUFFIX_ALIASES, identify, parse_symbol
from app.domain.keys import Key, analyze_chord_in_key, negative_pc
from app.domain.modulation import modulation_routes
from app.domain.pitch import LETTERS, parse_note
from app.domain.scales import SCALES, spell_scale
from app.domain.voicing import Step, realize

ROOTS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"]
KEYS = [r + m for r in ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"] for m in ("", "m")]
# Sufijos "estándar" (sin alias exóticos) para generar progresiones aleatorias.
SUFFIXES = ["", "m", "7", "maj7", "m7", "m7b5", "dim7", "6", "m6", "9", "m9", "sus4", "7b9", "13", "aug"]

roots = st.sampled_from(ROOTS)
suffixes = st.sampled_from(SUFFIXES)
chords = st.builds(lambda r, s: r + s, roots, suffixes)
keys = st.sampled_from(KEYS)


@given(st.integers(0, 11), st.integers(0, 11))
def test_negative_harmony_is_an_involution(pc, tonic):
    # Reflejar dos veces devuelve la nota original, y tónica <-> dominante.
    assert negative_pc(negative_pc(pc, tonic), tonic) == pc
    assert negative_pc(tonic, tonic) == (tonic + 7) % 12


@given(roots, st.sampled_from(sorted(_SUFFIX_ALIASES)))
def test_parse_then_identify_recovers_same_notes(root, suffix):
    p = parse_symbol(root + suffix)
    if len(set(p.pcs)) < 3:
        return  # power chords: dos notas no definen un acorde
    readings = identify(p.pcs, bass=p.root.pc, is_midi=False, limit=8)
    assert any(set(r.pcs) == set(p.pcs) for r in readings), (root + suffix, [r.symbol for r in readings])


@given(chords, st.integers(-11, 11))
def test_identification_is_transposition_invariant(sym, shift):
    p = parse_symbol(sym)
    notes = [48 + p.root.pc] + [60 + pc for pc in p.pcs]
    a = identify(notes)[0]
    b = identify([n + shift for n in notes])[0]
    assert (b.root_pc - a.root_pc) % 12 == shift % 12
    assert a.base.suffix == b.base.suffix and a.tensions == b.tensions


@given(keys)
def test_every_diatonic_chord_is_analyzed_as_diatonic(key_text):
    k = Key.parse(key_text)
    for sev in (False, True):
        for c in k.diatonic_chords(sev):
            info = analyze_chord_in_key(k, c["root_pc"], c["suffix"], c["pcs"])
            assert info["kind"] == "diatónico", (key_text, c["symbol"], info)


@given(roots, st.sampled_from(["", "m", "7", "maj7", "m7", "m7b5", "dim7", "aug", "6"]))
def test_chord_spelling_uses_stacked_thirds(root, suffix):
    # Cada nota de un acorde por terceras usa una letra distinta (Eb-G-Bb, nunca D#-G-A#).
    p = parse_symbol(root + suffix)
    letters = [n[0] for n in p.spelled]
    assert len(set(letters)) == len(letters)


@given(st.sampled_from(["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb"]),
       st.sampled_from([s for s in SCALES if len(s.degrees) == 7]))
def test_heptatonic_scales_use_each_letter_once(tonic, scale):
    notes = spell_scale(parse_note(tonic), scale)
    assert sorted(n[0] for n in notes) == sorted(LETTERS)


@settings(deadline=None)
@given(keys, keys)
def test_modulation_routes_start_and_end_on_the_tonics(a, b):
    res = modulation_routes(Key.parse(a), Key.parse(b))
    ta, tb = parse_symbol(a), parse_symbol(b)
    for r in res["routes"]:
        first, last = r["steps"][0], r["steps"][-1]
        assert {n % 12 for n in first["upper"]} == set(ta.pcs)
        assert {n % 12 for n in last["upper"]} == set(tb.pcs)
        assert r["avg_motion"] >= 0


@settings(deadline=None)
@given(st.lists(chords, min_size=1, max_size=8))
def test_voicings_contain_every_chord_tone(progression):
    steps = [Step.of(c) for c in progression]
    for st_, v in zip(steps, realize(steps)):
        assert {n % 12 for n in v["upper"]} == set(st_.pcs)
        assert v["bass"] % 12 == st_.bass_pc
        assert all(50 <= n <= 81 for n in v["upper"]) or len(v["upper"]) == len(st_.pcs)


@settings(deadline=None)
@given(st.lists(chords, min_size=1, max_size=10), st.one_of(st.none(), keys))
def test_progression_analysis_never_crashes(progression, key):
    res = analyze_progression(" ".join(progression), key)
    assert len(res["chords"]) == len(progression)
    for m in res["modulations"]:
        assert 0 < m["at"] < len(progression)


@settings(deadline=None)
@given(st.lists(chords, min_size=1, max_size=6), keys)
def test_negative_of_negative_is_original(progression, key):
    once = negative_progression(" ".join(progression), key)
    named = [(o, p["negative"]) for o, p in zip(progression, once["pairs"]) if not p["negative"].startswith("{")]
    if not named:
        return
    twice = negative_progression(" ".join(n for _, n in named), key)
    for (orig, _), back in zip(named, twice["pairs"]):
        if back["negative"].startswith("{"):
            continue
        assert set(parse_symbol(back["negative"]).pcs) == set(parse_symbol(orig).pcs)


@given(chords)
def test_scales_for_chord_contain_every_chord_tone(sym):
    from app.domain.scales import SCALES_BY_ID, scales_for_chord
    p = parse_symbol(sym)
    for s in scales_for_chord(p.root.pc, p.pcs, p.root.name):
        pcs = {(p.root.pc + d) % 12 for d in SCALES_BY_ID[s["id"]].degrees}
        assert set(p.pcs) - {(p.root.pc + 7) % 12} <= pcs


def test_scales_for_dominant_include_jazz_choices():
    from app.domain.scales import scales_for_chord
    ids = [s["id"] for s in scales_for_chord(7, parse_symbol("G7").pcs, "G")]
    assert ids[0] == "mixolydian" and {"lydian_dominant", "altered", "octatonic_hw"} <= set(ids)
