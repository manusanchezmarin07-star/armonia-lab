"""Conducción de voces: convierte acordes en voicings MIDI concretos.

Un cambio de acorde suena suave cuando las voces se mueven poco. Este módulo
elige, para cada acorde, el voicing que minimiza el movimiento respecto al
anterior, y anota qué notas se mantienen y cuáles se mueven.
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass

from .chords import TONES, ParsedChord, parse_symbol

UPPER_LOW, UPPER_HIGH = 50, 81  # Re3..La5: registro de la mano derecha (y algo de la izquierda)
BASS_LOW, BASS_HIGH = 36, 55     # Do2..Sol3


@dataclass
class Step:
    symbol: str
    pcs: list[int]
    bass_pc: int
    label: str = ""

    @staticmethod
    def of(symbol: str, label: str = "") -> Step:
        return Step.from_chord(parse_symbol(symbol), label)

    @staticmethod
    def from_chord(p: ParsedChord, label: str = "") -> Step:
        return Step(p.symbol, voicing_pcs(p), p.bass_pc, label)


def voicing_pcs(p: ParsedChord) -> list[int]:
    """Máximo 5 notas en la mano derecha; si sobran se quita primero la 5ª justa
    y luego la fundamental (el bajo ya la toca), como hacen los pianistas de jazz."""
    labels = list(p.labels)
    for drop in ("5", "1", "11"):
        if len(labels) > 5 and drop in labels:
            labels.remove(drop)
    return [(p.root.pc + TONES[l][0]) % 12 for l in labels[:5]]


def _candidates(pc: int, low: int, high: int) -> list[int]:
    return [m for m in range(low, high + 1) if m % 12 == pc]


def movement(a: list[int], b: list[int]) -> int:
    """Coste de ir del voicing a al b. Con igual número de voces el emparejamiento
    óptimo en 1D es ordenar ambos; si difieren, cada nota busca su más cercana."""
    if len(a) == len(b):
        return sum(abs(x - y) for x, y in zip(sorted(a), sorted(b)))
    # Con distinto número de voces, cada voz del conjunto mayor sale (o llega) de
    # la nota más cercana del menor: una voz que se divide en dos no cuenta doble.
    big, small = (a, b) if len(a) > len(b) else (b, a)
    return sum(min(abs(x - y) for y in small) for x in big)


def voice_lead(prev: list[int] | None, pcs: list[int]) -> list[int]:
    """Elige el voicing de `pcs` más cercano a `prev` (fuerza bruta acotada)."""
    if prev is None:
        # Primer acorde: posición cerrada alrededor de Do4.
        return sorted(60 - 5 + ((pc - 55) % 12) for pc in pcs)
    best, best_cost = None, None
    options = [_candidates(pc, UPPER_LOW, UPPER_HIGH) for pc in pcs]
    all_targets = sorted(m for opts in options for m in opts)
    for combo in itertools.product(*options):
        notes = sorted(combo)
        if len(set(notes)) != len(notes):
            continue
        # Si el acorde nuevo tiene menos notas que el anterior se duplican notas
        # (como en el coral clásico) para que ninguna voz "desaparezca" de golpe:
        # cada voz sobrante se queda en la nota del acorde nuevo más cercana.
        extra = len(prev) - len(notes)
        if extra > 0:
            leftovers = sorted(prev, key=lambda p: min(abs(p - n) for n in notes), reverse=True)[:extra]
            for p in leftovers:
                cand = min((m for m in all_targets if m not in notes), key=lambda m: abs(m - p), default=None)
                if cand is not None:
                    notes.append(cand)
            notes.sort()
        span = notes[-1] - notes[0]
        cost = movement(prev, notes) + max(0, span - 14) * 2
        if best_cost is None or cost < best_cost:
            best, best_cost = notes, cost
    return list(best) if best else sorted(pcs)


def realize(steps: list[Step]) -> list[dict]:
    """Convierte una lista de acordes en voicings MIDI con notas comunes y movimientos."""
    out: list[dict] = []
    prev_upper: list[int] | None = None
    prev_bass: int | None = None
    for st in steps:
        upper = voice_lead(prev_upper, st.pcs)
        if prev_bass is None:
            bass = _candidates(st.bass_pc, BASS_LOW, BASS_HIGH)[0]
            if bass < 40:
                bass += 12
        else:
            bass = min(_candidates(st.bass_pc, BASS_LOW, BASS_HIGH), key=lambda m: abs(m - prev_bass))
        held, moves = [], []
        if prev_upper is not None:
            held = sorted(set(prev_upper) & set(upper))
            a = sorted(set(prev_upper) - set(held))
            b = sorted(set(upper) - set(held))
            # Emparejamos cada voz que se mueve con su destino más cercano para
            # dibujar flechas comprensibles (no tiene por qué ser una biyección).
            for x in a:
                if b:
                    y = min(b, key=lambda n: abs(n - x))
                    moves.append({"from": x, "to": y, "semitones": y - x})
        motion = movement(prev_upper, upper) if prev_upper else 0
        out.append({
            "symbol": st.symbol, "label": st.label, "bass": bass, "upper": upper,
            "held": held, "moves": moves, "motion": motion,
        })
        prev_upper, prev_bass = upper, bass
    return out
