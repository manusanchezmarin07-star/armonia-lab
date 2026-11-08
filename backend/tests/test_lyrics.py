from hypothesis import given
from hypothesis import strategies as st

from app.domain.lyrics import align_to_asr, build_sheet, distribute_to_phrases, lines_from_asr

LETRA = "Hola mundo bonito\nquédate conmigo esta noche"
ASR = [{"text": t, "start": s, "end": s + 0.4} for t, s in
       [("hola", 1.0), ("mundo", 1.5), ("vonito", 2.0), ("quedate", 4.0), ("con", 4.5), ("migo", 4.8), ("esta", 5.4), ("noche", 6.0)]]


def test_align_uses_pasted_text_and_asr_times():
    lines = align_to_asr(LETRA, ASR)
    assert [w["text"] for w in lines[0]["words"]] == ["Hola", "mundo", "bonito"]
    assert lines[0]["words"][0]["start"] == 1.0 and lines[0]["words"][1]["start"] == 1.5
    # "bonito" no coincide con "vonito": se interpola entre sus vecinas.
    assert 1.9 <= lines[0]["words"][2]["start"] <= 4.0
    assert lines[1]["words"][0]["start"] == 4.0  # "quédate" ≈ "quedate" (sin tildes)


@given(st.lists(st.text(alphabet="abcdefg ", min_size=1, max_size=20), min_size=1, max_size=6),
       st.lists(st.floats(0, 100), min_size=0, max_size=10))
def test_align_times_are_monotonic(lines, starts):
    text = "\n".join(lines)
    asr = [{"text": "abc", "start": s, "end": s + 0.3} for s in sorted(starts)]
    out = align_to_asr(text, asr)
    flat = [w for line in out for w in line["words"]]
    assert all(w["end"] >= w["start"] for w in flat)
    if not asr:
        assert all(a["start"] <= b["start"] for a, b in zip(flat, flat[1:]))


def test_distribute_to_phrases_balances_lines():
    lines = distribute_to_phrases(LETRA, [(1.0, 3.0)], duration=10)
    assert len(lines) == 2  # una frase se parte para dos versos
    assert lines[0]["start"] == 1.0 and lines[1]["end"] == 3.0
    lines = distribute_to_phrases("una\ndos", [(0, 1), (2, 3), (4, 5)], duration=10)
    assert len(lines) == 2  # tres frases se unen en dos


def test_sheet_puts_chords_on_words_and_keeps_intro():
    lines = align_to_asr(LETRA, ASR)
    segs = [{"start": 0.0, "end": 1.0, "symbol": "Am"}, {"start": 1.0, "end": 2.0, "symbol": "F"},
            {"start": 2.0, "end": 4.0, "symbol": "C"}, {"start": 4.0, "end": 7.0, "symbol": "G"}]
    sheet = build_sheet(lines, segs, duration=7)
    assert sheet[0]["type"] == "instrumental" and sheet[0]["chords"][0]["symbol"] == "Am"
    verse = sheet[1]["words"]
    assert verse[0]["chord"]["symbol"] == "F" and verse[2]["chord"]["symbol"] == "C"
    assert sheet[2]["words"][0]["chord"]["symbol"] == "G"
    placed = [c["symbol"] for r in sheet for c in (r.get("chords") or [w["chord"] for w in r.get("words", []) if w["chord"]])]
    assert placed == ["Am", "F", "C", "G"]  # ningún acorde se pierde ni se duplica


def test_lines_from_whisper_segments():
    segs = [{"start": 0, "end": 2, "words": [{"word": " Hola", "start": 0.1, "end": 0.5}, {"word": " mundo", "start": 0.6, "end": 1.0}]}]
    assert lines_from_asr(segs)[0]["words"][1] == {"text": "mundo", "start": 0.6, "end": 1.0}
