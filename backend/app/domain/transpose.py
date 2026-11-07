"""Transporte de progresiones con deletreo correcto.

Transportar no es solo sumar semitonos: de Do a Mib, un Mi debe convertirse en
Sol (no en Fx). Por eso, cuando se conocen las tonalidades, se desplaza también
la letra (Do→Mi son 2 letras: cada nota sube 2 letras) y se ajusta la alteración.
"""
from __future__ import annotations

from .chords import chord_suffix, parse_progression
from .keys import Key
from .pitch import LETTERS, SpelledNote, letter_up, pc_name, spell_pc


def _move(note: SpelledNote, semis: int, letter_steps: int | None, prefer: str) -> str:
    pc = (note.pc + semis) % 12
    if letter_steps is None:
        return pc_name(pc, prefer)
    n = spell_pc(pc, letter_up(note.letter, letter_steps))
    # Dobles alteraciones (Fbb) y enarmonías raras (Fb, Cb, E#, B#) se simplifican:
    # son correctas en teoría pero en un cifrado nadie escribe Fb7 en vez de E7.
    if abs(n.alter) > 1 or n.name in ("Fb", "Cb", "E#", "B#"):
        return pc_name(pc, prefer)
    return n.name


def transpose(text: str, semitones: int | None = None, from_key: str | None = None, to_key: str | None = None) -> dict:
    """Transporta una progresión por semitonos o de una tonalidad a otra."""
    chords = parse_progression(text)
    letter_steps = None
    prefer = "default"
    if from_key and to_key:
        a, b = Key.parse(from_key), Key.parse(to_key)
        semitones = (b.tonic.pc - a.tonic.pc) % 12
        letter_steps = (LETTERS.index(b.tonic.letter) - LETTERS.index(a.tonic.letter)) % 7
        prefer = b.accidental_preference
    elif semitones is None:
        raise ValueError("Indica los semitonos o las dos tonalidades")
    elif to_key:
        prefer = Key.parse(to_key).accidental_preference
    out = []
    for c in chords:
        sym = _move(c.root, semitones, letter_steps, prefer) + chord_suffix(c.base, c.tensions)
        if c.bass:
            sym += "/" + _move(c.bass, semitones, letter_steps, prefer)
        out.append(sym)
    return {"chords": out, "text": " ".join(out), "semitones": semitones % 12}
