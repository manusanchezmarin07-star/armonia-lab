"""Diccionario de acordes: todo lo que se enseña debe ser coherente con el motor de teoría."""
import pytest

from app.domain.chord_catalog import GROUPS, ROOTS, catalog
from app.domain.chords import identify, parse_symbol
from app.domain.guitar import STANDARD


def _all(root):
    return [c for g in catalog(root)["groups"] for c in g["chords"]]


def test_catalog_covers_basics_and_has_no_duplicates():
    chords = _all("C")
    symbols = [c["symbol"] for c in chords]
    assert len(symbols) == len(set(symbols)) == sum(len(items) for _, _, items in GROUPS)
    assert {"C", "Cm", "C7", "Cmaj7", "Cm7", "Csus4", "Cdim7", "Cm7b5", "C9", "C13"} <= set(symbols)
    assert [c["symbol"] for c in chords if c["level"] == 1][:2] == ["C", "Cm"]


@pytest.mark.parametrize("root", ROOTS)
def test_every_chord_is_spelled_voiced_and_playable_on_guitar(root):
    for c in _all(root):
        parsed = parse_symbol(c["symbol"])
        # Las notas del voicing de piano son exactamente las del acorde, con la fundamental abajo.
        assert {n % 12 for n in c["notes"]} == set(parsed.pcs), c["symbol"]
        assert c["notes"][0] % 12 == parsed.root.pc
        assert [t["label"] for t in c["tones"]] == c["formula"] and len(c["tones"]) == len(c["formula"])
        # La posición de guitarra solo usa notas del acorde y tiene el bajo correcto.
        shape = c["guitar"]
        assert shape is not None, c["symbol"]
        sounding = [STANDARD[i] + f for i, f in enumerate(shape["frets"]) if f >= 0]
        assert {n % 12 for n in sounding} <= set(parsed.pcs), c["symbol"]
        assert min(sounding) % 12 == parsed.bass_pc


def test_piano_voicing_is_recognised_as_the_same_chord():
    """Lo que el diccionario enseña a tocar, el Laboratorio lo reconoce con ese mismo nombre (en los básicos)."""
    for c in _all("D"):
        if c["level"] == 1:
            assert identify(c["notes"])[0].symbol == c["symbol"], c["symbol"]


def test_root_is_validated():
    assert catalog("bb")["root"] == "Bb"
    with pytest.raises(ValueError):
        catalog("H#x")
