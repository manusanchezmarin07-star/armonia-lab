"""Melodía: de una curva de afinación (una frecuencia por instante) a notas con principio y fin.

La detección de la frecuencia la hace `infrastructure/melody.py` (pYIN); aquí está la
parte musical, sin audio, para poder probarla: redondear a semitonos, aguantar el
vibrato y los deslices, y descartar los chispazos que no son notas.
"""
from __future__ import annotations

import math

from .pitch import midi_name

MIN_NOTE = 0.09   # s: por debajo de esto no es una nota cantada, es un desliz o un error
MAX_GAP = 0.07    # s: un hueco así dentro de la misma nota es una consonante o un respiro


def hz_to_midi(hz: float) -> float:
    return 69 + 12 * math.log2(hz / 440.0)


def segment_notes(times: list[float], midi: list[float | None]) -> list[dict]:
    """Agrupa los instantes en notas. `midi[i]` es la altura (con decimales) o None si no hay voz.

    Cada nota se queda con la mediana de sus alturas: así un vibrato alrededor de La4
    es un La4 y no una ristra de La♭/La/Si♭.
    """
    if not times:
        return []
    step = (times[-1] - times[0]) / max(1, len(times) - 1) if len(times) > 1 else 0.02
    notes: list[dict] = []
    cur: dict | None = None
    for t, m in zip(times, midi):
        if m is None:
            continue
        # Sigue la nota en curso si está a menos de 0,7 semitonos de su centro y no hay un hueco largo.
        if cur and abs(m - cur["center"]) < 0.7 and t - cur["end"] <= MAX_GAP + step:
            cur["values"].append(m)
            cur["end"] = t + step
            vals = sorted(cur["values"])
            cur["center"] = vals[len(vals) // 2]
        else:
            cur = {"start": t, "end": t + step, "values": [m], "center": m}
            notes.append(cur)
    out: list[dict] = []
    for n in notes:
        pitch = int(round(n["center"]))
        if n["end"] - n["start"] < MIN_NOTE:
            continue
        # Dos trozos seguidos de la misma nota (separados por un desliz descartado) se unen.
        if out and out[-1]["midi"] == pitch and n["start"] - out[-1]["end"] <= MAX_GAP:
            out[-1]["end"] = round(n["end"], 3)
            continue
        out.append({"start": round(n["start"], 3), "end": round(n["end"], 3), "midi": pitch, "name": midi_name(pitch)})
    return out


def trim_outliers(notes: list[dict], span: int = 14) -> list[dict]:
    """Quita las notas muy lejos del registro de la melodía (más de una octava y un tono).

    En una pista separada quedan restos de otros instrumentos (un bajo dos octavas por
    debajo de la voz): no son melodía y además falsean la tesitura. El centro es la
    mediana ponderada por duración, para que un par de notas largas no la muevan.
    """
    if len(notes) < 4:
        return notes
    weighted = sorted((n["midi"], n["end"] - n["start"]) for n in notes)
    half = sum(d for _, d in weighted) / 2
    acc = 0.0
    center = weighted[0][0]
    for pitch, dur in weighted:
        acc += dur
        if acc >= half:
            center = pitch
            break
    return [n for n in notes if abs(n["midi"] - center) <= span]


def summarize(notes: list[dict], key_tonic_pc: int | None = None) -> dict:
    """Datos de conjunto: tesitura, y qué grado de la tonalidad es cada nota (para colorearlas)."""
    if not notes:
        return {"low": None, "high": None, "count": 0}
    if key_tonic_pc is not None:
        for n in notes:
            n["degree"] = (n["midi"] - key_tonic_pc) % 12
    return {"low": min(n["midi"] for n in notes), "high": max(n["midi"] for n in notes), "count": len(notes)}
