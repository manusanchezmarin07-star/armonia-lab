"""Notas, clases de altura y deletreo enharmónico.

Trabajamos internamente con *pitch classes* (0 = Do ... 11 = Si) porque la armonía
funcional es invariante a la octava. El nombre de la nota (Re# vs Mib) se calcula
aparte, porque depende del contexto (tonalidad o acorde) y equivocarlo es uno de
los errores más típicos de las herramientas musicales.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

LETTERS = ["C", "D", "E", "F", "G", "A", "B"]
# Pitch class de cada letra natural.
LETTER_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
SOLFEGE = {"C": "Do", "D": "Re", "E": "Mi", "F": "Fa", "G": "Sol", "A": "La", "B": "Si"}

# Nombres por defecto cuando no hay contexto: bemoles salvo F#, que es mucho más
# habitual que Gb en la práctica (tonalidades de Re, La, Mi mayor...).
DEFAULT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

_NOTE_RE = re.compile(r"^([A-Ga-g])(##|bb|#|b|♯|♭|x)?$")


@dataclass(frozen=True)
class SpelledNote:
    """Nota con letra y alteración (p. ej. letra 'E', alter -1 = Mib)."""

    letter: str
    alter: int

    @property
    def pc(self) -> int:
        return (LETTER_PC[self.letter] + self.alter) % 12

    @property
    def name(self) -> str:
        acc = {-2: "bb", -1: "b", 0: "", 1: "#", 2: "##"}.get(self.alter)
        if acc is None:
            raise ValueError(f"Alteración no soportada: {self.alter}")
        return self.letter + acc

    @property
    def solfege(self) -> str:
        acc = {-2: "bb", -1: "b", 0: "", 1: "#", 2: "x"}[self.alter]
        return SOLFEGE[self.letter] + acc


def parse_note(text: str) -> SpelledNote:
    """Convierte 'Eb', 'F#', 'c', 'Bbb', 'E♭' en una SpelledNote."""
    m = _NOTE_RE.match(text.strip())
    if not m:
        raise ValueError(f"Nota no válida: {text!r}")
    letter = m.group(1).upper()
    acc = m.group(2) or ""
    alter = {"": 0, "#": 1, "♯": 1, "##": 2, "x": 2, "b": -1, "♭": -1, "bb": -2}[acc]
    return SpelledNote(letter, alter)


def spell_pc(pc: int, letter: str) -> SpelledNote:
    """Deletrea la pitch class `pc` usando obligatoriamente la letra `letter`.

    Es la base del deletreo correcto de acordes: la 3ª de Mib debe ser una 'G'
    (Sol) y no un 'Fx', así que primero se decide la letra por grado y luego la
    alteración que haga falta.
    """
    diff = (pc - LETTER_PC[letter]) % 12
    alter = diff if diff <= 6 else diff - 12
    return SpelledNote(letter, alter)


def letter_up(letter: str, steps: int) -> str:
    """Letra que está `steps` grados por encima (C + 2 -> E)."""
    return LETTERS[(LETTERS.index(letter) + steps) % 7]


def pc_name(pc: int, prefer: str = "default") -> str:
    table = {"sharp": SHARP_NAMES, "flat": FLAT_NAMES}.get(prefer, DEFAULT_NAMES)
    return table[pc % 12]


def midi_to_pc(midi: int) -> int:
    return midi % 12


def midi_name(midi: int, prefer: str = "default") -> str:
    """Nombre científico: 60 -> C4 (convención MIDI estándar, Do central = C4)."""
    return f"{pc_name(midi, prefer)}{midi // 12 - 1}"


def interval_name(semitones: int) -> str:
    """Nombre del intervalo simple en español a partir de semitonos."""
    names = [
        "unísono", "2ª menor", "2ª mayor", "3ª menor", "3ª mayor", "4ª justa",
        "tritono", "5ª justa", "6ª menor", "6ª mayor", "7ª menor", "7ª mayor",
    ]
    return names[semitones % 12]
