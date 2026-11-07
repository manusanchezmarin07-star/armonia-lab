from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain.chords import TONES, parse_symbol
from app.domain.reharm import STYLES, chords_for_melody, melody_role, reharmonize, substitutes


def test_dominant_substitutes_include_the_classics():
    syms = {s["symbol"] for s in substitutes("G7", "C", "Cmaj7")["substitutes"]}
    assert {"Db7", "Bb7", "Fm6", "Bdim7"} <= syms


def test_substitutes_sorted_by_smoothness_when_next_given():
    subs = substitutes("G7", "C", "Cmaj7")["substitutes"]
    motions = [s["motion_to_next"] for s in subs]
    assert motions == sorted(motions)


def test_tonic_substitutes():
    syms = {s["symbol"] for s in substitutes("Cmaj7", "C")["substitutes"]}
    assert {"Em7", "Am7", "Abmaj7", "Cm7"} <= syms


def test_melody_roles():
    assert melody_role(parse_symbol("Cmaj7"), 4)["role"] == "nota del acorde"
    assert melody_role(parse_symbol("Cmaj7"), 2)["label"] == "9"
    assert melody_role(parse_symbol("Cmaj7"), 5)["role"] == "nota a evitar"  # Fa sobre Cmaj7 choca con Mi


def test_every_chord_for_a_melody_note_contains_it():
    res = chords_for_melody("E", "C", limit=100)
    assert res["chords"]
    for c in res["chords"]:
        assert c["melody"]["ok"]
        p = parse_symbol(c["symbol"])
        # La etiqueta (3, 9, #11...) debe corresponder exactamente al intervalo real.
        assert TONES[c["melody"]["label"]][0] == (4 - p.root.pc) % 12
    assert res["chords"][0]["kind"] == "diatónico"


@settings(deadline=None, max_examples=30)
@given(st.sampled_from(list(STYLES)), st.sampled_from(["C", "F", "Bb", "Am", "E"]))
def test_reharmonize_keeps_length_order_and_parses(style, key):
    res = reharmonize("Cmaj7 Am7 Dm7 G7 Cmaj7", key, style)
    assert {o["of"] for o in res["reharmonized"]} == set(range(5))
    for o in res["reharmonized"]:
        parse_symbol(o["symbol"])
