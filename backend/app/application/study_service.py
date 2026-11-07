"""Estudio de obras reales: une los datos del corpus con nuestro motor de análisis."""
from __future__ import annotations

from app.domain.chords import identify
from app.domain.keys import Key, analyze_chord_in_key
from app.infrastructure import bach_corpus


def chorales() -> list[dict]:
    return bach_corpus.list_chorales()


def chorale(chorale_id: str) -> dict:
    data = dict(bach_corpus.load_chorale(chorale_id))
    key = Key.parse(data["key"])
    analyzed = []
    for ch in data["chords"]:
        readings = identify(ch["midi"], prefer=key.accidental_preference)
        if readings:
            r = readings[0]
            a = analyze_chord_in_key(key, r.root_pc, r.base.suffix, r.pcs)
            analyzed.append({**ch, "symbol": r.symbol, "roman": a["roman"], "kind": a["kind"],
                             "function": a["function"], "explanation": a["explanation"]})
        else:
            # Dos voces al unísono o una nota de paso aislada: no hay acorde que nombrar.
            analyzed.append({**ch, "symbol": None, "roman": None, "kind": "notas de paso",
                             "function": None, "explanation": "Sonoridad incompleta (notas de paso o unísonos)."})
    data["chords"] = analyzed
    return data
