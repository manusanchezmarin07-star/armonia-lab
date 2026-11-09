"""Guitarra: el buscador de posiciones debe encontrar los acordes de manual con su digitación."""
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain.chords import parse_symbol
from app.domain.guitar import STANDARD, assign_fingers, chord_shapes, fretboard

# Acorde → posición de manual que debe salir la PRIMERA (diagrama y dedos).
FIRST = {
    "C": ("x32010", "032010"), "G": ("320003", "210003"), "D": ("xx0232", "000132"), "Am": ("x02210", "002310"),
    "E": ("022100", "023100"), "Em": ("022000", "012000"), "A": ("x02220", "001230"), "Dm": ("xx0231", "000231"),
    "E7": ("020100", "020100"), "A7": ("x02020", "001020"), "D7": ("xx0212", "000213"), "B7": ("x21202", "021304"),
    "G7": ("320001", "320001"), "C7": ("x32310", "032410"), "Cmaj7": ("x32000", "021000"), "Dm7": ("xx0211", "000312"),
}
# Acordes con cejilla: la posición de manual debe estar entre las tres primeras.
TOP3 = {"F": "133211", "Bm": "x24432", "F#m": "244222", "Bb": "x13331", "Fm": "133111", "B": "x24442", "Cm": "x35543"}


@pytest.mark.parametrize("symbol,expected", FIRST.items())
def test_open_chords_come_first_with_textbook_fingering(symbol, expected):
    top = chord_shapes(symbol, limit=3)[0]
    assert (top["diagram"], "".join(map(str, top["fingers"]))) == expected


@pytest.mark.parametrize("symbol,diagram", TOP3.items())
def test_barre_chords_are_found(symbol, diagram):
    shapes = chord_shapes(symbol, limit=3)
    assert diagram in [s["diagram"] for s in shapes], [s["diagram"] for s in shapes]
    barre = next(s for s in shapes if s["diagram"] == diagram)
    assert barre["barre"] is not None


def test_capo_shifts_shapes():
    # Con cejilla en II, el La mayor se toca con la forma de Sol (como en un cancionero).
    assert chord_shapes("A", capo=2, limit=1)[0]["diagram"] == "320003"


def test_fretboard_marks_scale_notes():
    cells = fretboard([0, 2, 4, 5, 7, 9, 11], root_pc=0, frets=3)
    assert {"string": 5, "fret": 3, "midi": 48, "pc": 0, "root": True} in cells  # Do en la 5ª cuerda, traste 3
    assert all(c["pc"] in {0, 2, 4, 5, 7, 9, 11} for c in cells)


def test_unplayable_stretch_is_rejected():
    assert assign_fingers((1, 6, -1, -1, -1, -1)) is None


# Sin plazo por ejemplo: la búsqueda de posiciones con cejilla tarda más en los runners de CI.
@settings(deadline=None)
@given(st.sampled_from(["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]),
       st.sampled_from(["", "m", "7", "maj7", "m7", "m7b5", "dim7", "sus4", "6", "9", "7b9", "13"]), st.integers(0, 5))
def test_every_shape_is_playable_and_correct(root, suffix, capo):
    chord = parse_symbol(root + suffix)
    for sh in chord_shapes(root + suffix, capo=capo, limit=4):
        notes = [STANDARD[s] + capo + f for s, f in enumerate(sh["frets"]) if f >= 0]
        assert {n % 12 for n in notes} <= set(chord.pcs)          # solo notas del acorde
        assert min(notes) % 12 == chord.bass_pc                    # el bajo es el correcto
        pressed = [f for f in sh["frets"] if f > 0]
        assert not pressed or max(pressed) - min(pressed) <= 3     # sin estiramientos imposibles
        fingers = [f for f, fr in zip(sh["fingers"], sh["frets"]) if fr > 0]
        assert all(1 <= f <= 4 for f in fingers)                   # cuatro dedos como mucho
        if not sh["barre"]:
            assert len(set(fingers)) == len(fingers)               # sin cejilla, un dedo por nota
