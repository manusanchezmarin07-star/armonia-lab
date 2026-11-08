from hypothesis import given
from hypothesis import strategies as st

from app.domain.chords import parse_symbol
from app.domain.hands import STYLES, fingering, two_hands

ROOTS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
SUFFIXES = ["", "m", "7", "maj7", "m7", "m7b5", "dim7", "6", "m6", "9", "maj9", "m11", "13", "7(b9,#9,#11,b13)", "sus4", "aug"]


def test_textbook_fingerings():
    assert fingering([60, 64, 67], "right") == [1, 3, 5]      # Do-Mi-Sol
    assert fingering([64, 67, 72], "right") == [1, 2, 5]      # Mi-Sol-Do (1ª inversión)
    assert fingering([67, 72, 76], "right") == [1, 3, 5]      # Sol-Do-Mi (2ª inversión)
    assert fingering([48, 52, 55], "left") == [5, 3, 1]
    assert fingering([52, 55, 60], "left") == [5, 3, 1]       # Mi-Sol-Do en la izquierda
    assert fingering([55, 60, 64], "left") == [5, 2, 1]       # Sol-Do-Mi en la izquierda
    assert fingering([48, 55], "left") == [5, 1]              # fundamental y 5ª
    assert fingering([60, 64, 67, 71], "right") == [1, 2, 3, 5]  # Cmaj7


def test_inversions_put_the_right_note_at_the_bottom():
    assert two_hands("C", "basico", 1)["right"][0]["note"].startswith("E")
    assert two_hands("C", "basico", 2)["right"][0]["note"].startswith("G")


def test_jazz_shell_left_hand_root_and_seventh():
    r = two_hands("Dm7", "jazz")
    assert [x["role"] for x in r["left"]] == ["fundamental", "7ª menor"]


@given(st.sampled_from(ROOTS), st.sampled_from(SUFFIXES), st.sampled_from(list(STYLES)), st.integers(0, 3))
def test_two_hands_invariants(root, suffix, style, inv):
    sym = root + suffix
    r = two_hands(sym, style, inv)
    left, right = r["left"], r["right"]
    lh, rh = [x["midi"] for x in left], [x["midi"] for x in right]
    assert 1 <= len(rh) <= 5 and 1 <= len(lh) <= 5
    assert not lh or not rh or max(lh) < min(rh)  # las manos no se cruzan
    for hand in (left, right):
        fingers = [x["finger"] for x in hand]
        assert all(1 <= f <= 5 for f in fingers) and len(set(fingers)) == len(fingers)
    # Dedos ordenados: en la derecha suben con la altura, en la izquierda bajan.
    assert [x["finger"] for x in right] == sorted(x["finger"] for x in right)
    assert [x["finger"] for x in left] == sorted((x["finger"] for x in left), reverse=True)
    # Todas las notas pertenecen al acorde y las esenciales (3ª y 7ª) están presentes.
    p = parse_symbol(sym)
    played = {m % 12 for m in lh + rh}
    assert played <= set(p.pcs) | {p.bass_pc}
    for lab in ("3", "b3", "b7", "7", "bb7"):
        if lab in p.labels:
            assert any(x["role"] for x in left + right)
    assert all(36 <= m <= 84 for m in lh + rh)


def test_note_names_follow_chord_spelling():
    r = two_hands("Db7", "basico")
    assert [x["note"] for x in r["right"]] == ["Db4", "F4", "Ab4", "Cb5"]


def test_arrange_moves_less_than_root_position():
    from app.domain.hands import arrange
    from app.domain.voicing import movement
    prog = ["C", "Am", "F", "G7", "Em", "Am", "Dm7", "G7", "C"]
    smooth = arrange(prog)
    naive = [two_hands(s, "basico", 0) for s in prog]

    def total(vs):
        rhs = [[x["midi"] for x in v["right"]] for v in vs]
        return sum(movement(a, b) for a, b in zip(rhs, rhs[1:]))
    assert total(smooth) < total(naive)
    assert all(v["left"] and v["right"] for v in smooth)
