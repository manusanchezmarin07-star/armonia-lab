"""Corales de Bach del corpus de music21 (partituras de dominio público incluidas
en la librería): datos reales para estudiar armonía a cuatro voces."""
from __future__ import annotations

import re
import tempfile
from functools import lru_cache
from pathlib import Path

from music21 import corpus, roman

_CHORALE_RE = re.compile(r"^bwv(\d+)\.(\d+)$")


@lru_cache(maxsize=1)
def list_chorales() -> list[dict]:
    """Lista ligera (sin parsear las partituras, que tardaría ~1 min con 400 corales)."""
    out = []
    for p in corpus.getComposer("bach"):
        stem = Path(p).stem
        m = _CHORALE_RE.match(stem)
        if m:
            out.append({"id": stem, "bwv": int(m.group(1)), "title": f"BWV {m.group(1)}.{m.group(2)}"})
    out.sort(key=lambda c: (c["bwv"], c["id"]))
    return out


@lru_cache(maxsize=32)
def load_chorale(chorale_id: str) -> dict:
    """Devuelve notas por voz, acordes (chordify) con la cifra romana de music21 y el MusicXML."""
    if not _CHORALE_RE.match(chorale_id):
        raise ValueError("Identificador de coral no válido")
    # Se comprueba contra la lista antes de parsear: music21 lanza su propia excepción
    # (no ValueError) para obras inexistentes, y acababa en un error 500.
    if chorale_id not in {c["id"] for c in list_chorales()}:
        raise ValueError(f"No existe el coral {chorale_id}")
    score = corpus.parse(f"bach/{chorale_id}")
    key = score.analyze("key")
    title = (score.metadata.title if score.metadata and score.metadata.title else None) or chorale_id.upper()

    voices = []
    for part in score.parts:
        notes = []
        for n in part.flatten().notes:
            for p in getattr(n, "pitches", []):
                notes.append({"t": float(n.offset), "d": float(n.quarterLength), "m": p.midi})
        voices.append({"name": part.partName or "Voz", "notes": notes})

    chords = []
    for ch in score.chordify().flatten().getElementsByClass("Chord"):
        try:
            rn = roman.romanNumeralFromChord(ch, key).figure
        except Exception:  # music21 no siempre puede cifrar acordes incompletos
            rn = None
        chords.append({"t": float(ch.offset), "d": float(ch.quarterLength), "measure": ch.measureNumber,
                       "midi": sorted(p.midi for p in ch.pitches), "m21_roman": rn})

    with tempfile.TemporaryDirectory() as tmp:
        path = score.write("musicxml", fp=Path(tmp) / "score.musicxml")
        xml = Path(path).read_text(encoding="utf-8")

    tonic = key.tonic.name.replace("-", "b")
    return {"id": chorale_id, "title": title, "key": tonic + ("m" if key.mode == "minor" else ""),
            "key_name": f"{tonic} {'menor' if key.mode == 'minor' else 'mayor'}",
            "voices": voices, "chords": chords, "musicxml": xml}
