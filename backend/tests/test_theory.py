"""Tests del motor de teoría contrastados con music21 (MIT), que actúa como
"segunda opinión" independiente: si nuestro cálculo y el suyo discrepan, falla."""
import pytest
from music21 import chord as m21chord
from music21 import harmony, roman
from music21 import scale as m21scale

from app.domain.analysis import analyze_progression, negative_progression
from app.domain.chords import identify, parse_symbol
from app.domain.keys import Key, analyze_chord_in_key, negative_pc
from app.domain.modulation import diminished_family, explain_transition, modulation_routes, pivot_chords
from app.domain.pitch import parse_note
from app.domain.scales import SCALES_BY_ID, scale_info

SYMBOLS = ["C", "Cm", "Cdim", "Caug", "C7", "Cmaj7", "Cm7", "Cm7b5", "Cdim7", "C6", "Cm6",
           "Csus4", "C9", "Cmaj9", "Cm9", "C13", "C7b9", "C7#9", "C7#11", "Cm11",
           "Eb7", "F#m7", "Bbmaj7", "Abm7b5", "Dbdim7", "G7b9", "E9", "Am11"]


def m21_pcs(symbol: str) -> set[int]:
    """music21 usa '-' para los bemoles y 'M9' para maj9. Además apila la 11ª en
    los acordes de 13ª; en cifrado de jazz la 11ª natural se omite sobre un
    acorde con 3ª mayor (choca con ella), así que se descuenta para comparar."""
    m21 = symbol.replace("m7b5", "ø7").replace("maj9", "M9")
    if len(m21) > 1 and m21[1] == "b":
        m21 = m21[0] + "-" + m21[2:]
    pcs = {p.pitchClass for p in harmony.ChordSymbol(m21).pitches}
    if symbol.endswith("13") and "m" not in symbol:
        pcs.discard((parse_symbol(symbol).root.pc + 5) % 12)
    return pcs


@pytest.mark.parametrize("symbol", SYMBOLS)
def test_symbol_pitch_classes_match_music21(symbol):
    assert set(parse_symbol(symbol).pcs) == m21_pcs(symbol)


@pytest.mark.parametrize("symbol", ["C", "Cm", "C7", "Cmaj7", "Cm7", "Cm7b5", "Ebmaj7", "F#m7", "Bb7", "Abm"])
def test_identify_root_matches_music21(symbol):
    p = parse_symbol(symbol)
    midi = [48 + p.root.pc] + [60 + pc for pc in p.pcs]
    ours = identify(midi)[0]
    theirs = m21chord.Chord(midi).root().pitchClass
    assert ours.root_pc == theirs
    assert ours.symbol == p.symbol


def test_identify_inversions_and_ambiguity():
    assert identify([64, 67, 72])[0].symbol == "C/E"
    assert identify([60, 64, 67, 69])[0].symbol == "C6"
    assert identify([57, 60, 64, 67])[0].symbol == "Am7"


def test_identify_dense_voicings():
    assert identify([60, 64, 67, 71, 74, 78])[0].symbol == "Cmaj9(#11)"
    assert identify([43, 59, 65, 68, 70])[0].symbol == "G7(b9,#9)"


@pytest.mark.parametrize("key_text,m21_key", [("C", "C"), ("Eb", "E-"), ("A", "A"), ("F#", "F#")])
def test_diatonic_sevenths_match_music21(key_text, m21_key):
    key = Key.parse(key_text)
    figures = ["I7", "ii7", "iii7", "IV7", "V7", "vi7", "viiø7"]
    for ours, fig in zip(key.diatonic_chords(True), figures):
        theirs = {p.pitchClass for p in roman.RomanNumeral(fig, m21_key).pitches}
        assert set(ours["pcs"]) == theirs, (key_text, fig)


def test_minor_key_uses_harmonic_dominant():
    chords = Key.parse("Am").diatonic_chords(True)
    assert chords[4]["symbol"] == "E7"
    assert chords[6]["symbol"] == "G#dim7"


def test_key_spelling():
    assert [n.name for n in Key.parse("F#").scale] == ["F#", "G#", "A#", "B", "C#", "D#", "E#"]
    assert [n.name for n in Key.parse("Bbm").scale] == ["Bb", "C", "Db", "Eb", "F", "Gb", "Ab"]


@pytest.mark.parametrize("sid,cls", [("dorian", m21scale.DorianScale), ("phrygian", m21scale.PhrygianScale),
                                      ("lydian", m21scale.LydianScale), ("mixolydian", m21scale.MixolydianScale),
                                      ("locrian", m21scale.LocrianScale), ("harmonic_minor", m21scale.HarmonicMinorScale),
                                      ("melodic_minor", m21scale.MelodicMinorScale)])
def test_modes_match_music21(sid, cls):
    for tonic in ("C", "E-", "F#"):
        ours = scale_info(tonic.replace("-", "b"), sid)["pcs"]
        theirs = [p.pitchClass for p in cls(tonic).getPitches()][:7]
        assert ours == theirs


def test_symmetric_scale_transpositions():
    expected = {"whole_tone": 2, "octatonic_hw": 3, "augmented": 4, "messiaen_3": 4, "messiaen_4": 6,
                "messiaen_5": 6, "messiaen_6": 6, "messiaen_7": 6, "chromatic": 1, "ionian": 12}
    for sid, n in expected.items():
        assert SCALES_BY_ID[sid].transpositions == n, sid
        assert sum(SCALES_BY_ID[sid].steps) == 12


def test_negative_harmony_g7_is_fm6():
    neg = {negative_pc(p, 0) for p in parse_symbol("G7").pcs}
    assert neg == set(parse_symbol("Fm6").pcs)
    assert negative_pc(4, 0) == 3 and negative_pc(0, 0) == 7


def test_negative_progression_ii_v_i():
    r = negative_progression("Dm7 G7 Cmaj7", "C")
    assert [p["negative"] for p in r["pairs"]] == ["Gm7", "Dm7b5", "Abmaj7"]
    assert "Fm6" in r["pairs"][1]["alternatives"]


def test_functional_labels():
    c = Key.parse("C")
    def kind(sym):
        p = parse_symbol(sym)
        return analyze_chord_in_key(c, p.root.pc, p.base.suffix, p.pcs)
    assert kind("D7")["roman"] == "V7/V"
    assert kind("Db7")["kind"] == "sustituto tritonal"
    assert kind("C#dim7")["kind"].startswith("disminuido")
    assert kind("Fm")["kind"] == "préstamo modal"
    assert kind("Fm6").get("negative_of") == "G7"
    assert kind("Db")["kind"] == "napolitano / bII"


def test_progression_detects_modulation():
    r = analyze_progression("Dm7 G7 Cmaj7 Cm7 F7 Bbmaj7")
    assert r["key"] == "C mayor"
    assert r["modulations"][0]["to"] == "Bb mayor"


def test_secondary_dominants_do_not_modulate():
    r = analyze_progression("Cmaj7 E7 Am7 D7 G7 Cmaj7")
    assert r["modulations"] == []
    assert [c["analysis"]["roman"] for c in r["chords"]][1] == "V7/vi"


def test_pivots_c_to_g():
    piv = {p["symbol"] for p in pivot_chords(Key.parse("C"), Key.parse("G"))}
    assert {"Am", "Em", "C", "G"} <= piv


def test_diminished_family():
    fam = diminished_family(parse_symbol("Bdim7").pcs)
    assert {f["dominant"] for f in fam} == {"G7", "Bb7", "Db7", "E7"}


def test_routes_are_voice_led():
    r = modulation_routes(Key.parse("C"), Key.parse("Ab"))
    assert r["routes"]
    for route in r["routes"]:
        for step in route["steps"]:
            assert all(50 <= n <= 81 for n in step["upper"][1:])


def test_transition_relations():
    t = explain_transition("G7", "C")
    assert any("dominante (V)" in rel for rel in t["relations"])
    assert t["common_tones"] == ["G"]


def test_parse_note_variants():
    assert parse_note("E♭").pc == 3 and parse_note("Cb").pc == 11 and parse_note("B#").pc == 0


def test_major_seventh_tension_is_spelled_maj7():
    r = identify([60, 61, 64, 67, 70])  # C7(b9): una lectura alternativa es Dbdim7 con 7ª mayor
    assert all("(7)" not in x.symbol for x in identify([61, 64, 67, 70, 72], limit=8))
    assert parse_symbol("Dbdim7(maj7)/C").pcs == parse_symbol("Dbdim7(7)/C").pcs
    assert r[0].symbol == "C7(b9)"
