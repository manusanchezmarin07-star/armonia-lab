"""Casos de uso de teoría: orquesta el dominio y da forma a las respuestas de la API."""
from __future__ import annotations

from app.domain import analysis, modulation, rhythm, scales
from app.domain.chords import identify, parse_symbol
from app.domain.keys import Key, analyze_chord_in_key
from app.domain.modulation import Step, _drop_for_voicing, realize
from app.domain.pitch import midi_name


def identify_notes(notes: list[int], key_text: str | None) -> dict:
    key = Key.parse(key_text) if key_text else None
    prefer = key.accidental_preference if key else "default"
    readings = identify(notes, prefer=prefer)
    out = []
    for r in readings:
        d = r.to_dict()
        if key:
            d["analysis"] = analyze_chord_in_key(key, r.root_pc, r.base.suffix, r.pcs)
        out.append(d)
    return {"notes": [{"midi": n, "name": midi_name(n, prefer)} for n in sorted(notes)], "readings": out}


def parse_chord(symbol: str, key_text: str | None) -> dict:
    p = parse_symbol(symbol)
    d = p.to_dict()
    d["voicing"] = realize([Step(p.symbol, _drop_for_voicing(p), p.bass_pc)])[0]
    if key_text:
        k = Key.parse(key_text)
        d["analysis"] = analyze_chord_in_key(k, p.root.pc, p.base.suffix, p.pcs)
    return d


def transition(a: str, b: str) -> dict:
    return modulation.explain_transition(a, b)


def diatonic(key_text: str) -> dict:
    k = Key.parse(key_text)
    return {"key": k.name, "scale": [n.name for n in k.scale],
            "triads": k.diatonic_chords(False), "sevenths": k.diatonic_chords(True)}


def modulate(a: str, b: str) -> dict:
    return modulation.modulation_routes(Key.parse(a), Key.parse(b))


def scale_catalog() -> list[dict]:
    return scales.scale_catalog()


def scale(scale_id: str, tonic: str) -> dict:
    return scales.scale_info(tonic, scale_id)


def analyze(text: str, key_text: str | None) -> dict:
    return analysis.analyze_progression(text, key_text)


def negative(text: str, key_text: str) -> dict:
    return analysis.negative_progression(text, key_text)


def rhythm_catalog() -> dict:
    return rhythm.catalog()
