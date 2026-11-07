from hypothesis import given
from hypothesis import strategies as st

from app.domain.chords import parse_symbol
from app.domain.transpose import transpose


def test_transpose_between_keys_spells_correctly():
    assert transpose("Cmaj7 Em7 A7(b9) Dm7 G7/B", from_key="C", to_key="Eb")["chords"] == \
        ["Ebmaj7", "Gm7", "C7(b9)", "Fm7", "Bb7/D"]
    assert transpose("C E7 Am", from_key="C", to_key="F#")["chords"] == ["F#", "A#7", "D#m"]


def test_transpose_by_semitones():
    assert transpose("C F G7", semitones=2)["chords"] == ["D", "G", "A7"]


@given(st.integers(-24, 24))
def test_transpose_preserves_chord_shapes(n):
    src = "Cmaj7 Dm7b5 G7(b9) Am(maj7)(9) F#dim7 Bb13/D"
    res = transpose(src, semitones=n)["chords"]
    for a, b in zip(src.split(), res):
        pa, pb = parse_symbol(a), parse_symbol(b)
        assert sorted((p - pa.root.pc) % 12 for p in pa.pcs) == sorted((p - pb.root.pc) % 12 for p in pb.pcs)
        assert (pb.root.pc - pa.root.pc) % 12 == n % 12


def test_transpose_avoids_rare_enharmonics():
    assert transpose("Db7 Abmaj7", from_key="C", to_key="Eb")["chords"] == ["E7", "Bmaj7"]
