"""Diccionario de acordes: todos los tipos que entiende el motor de teoría, agrupados
para estudiarlos, con sus notas, su fórmula y cómo se tocan en piano y en guitarra.

El catálogo se genera a partir de `BASE_CHORDS` y de las tensiones que admite cada
tipo, no de una lista escrita a mano: así cualquier acorde que salga aquí es uno
que el resto de la app sabe reconocer, analizar y enseñar a tocar.
"""
from __future__ import annotations

from . import guitar
from .chords import BASE_BY_SUFFIX, TONE_NAMES_ES, TONES, chord_suffix, parse_symbol

ROOTS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

# (tipo base, tensiones, nivel). Nivel 1 = los que salen en cualquier cancionero,
# 2 = pop/jazz habitual, 3 = colores avanzados.
_G = tuple[str, tuple[str, ...], int]
GROUPS: list[tuple[str, str, list[_G]]] = [
    ("Tríadas", "Tres notas. Mayor y menor son la base de casi toda la música; las demás son sus variantes.",
     [("", (), 1), ("m", (), 1), ("dim", (), 2), ("aug", (), 2), ("sus4", (), 1), ("sus2", (), 1), ("5", (), 1)]),
    ("Sextas y notas añadidas", "Una tríada con una nota más que le da color sin cambiar su función.",
     [("6", (), 2), ("m6", (), 2), ("", ("9",), 2), ("m", ("9",), 2), ("6", ("9",), 2), ("m6", ("9",), 3),
      ("", ("#11",), 3), ("m", ("11",), 3), ("sus4", ("9",), 3)]),
    ("Séptimas", "Cuatro notas. Son los acordes del jazz, la bossa y el flamenco moderno.",
     [("maj7", (), 1), ("7", (), 1), ("m7", (), 1), ("m7b5", (), 2), ("dim7", (), 2), ("m(maj7)", (), 2),
      ("7sus4", (), 2), ("7#5", (), 3), ("7b5", (), 3), ("maj7#5", (), 3)]),
    ("Novenas", "Una séptima más la 9ª (la 2ª una octava arriba).",
     [("maj7", ("9",), 2), ("7", ("9",), 2), ("m7", ("9",), 2), ("7", ("b9",), 2), ("7", ("#9",), 2),
      ("7sus4", ("9",), 3), ("7sus4", ("b9",), 3), ("m(maj7)", ("9",), 3), ("m7b5", ("9",), 3)]),
    ("Oncenas y trecenas", "Acordes de cinco, seis o siete notas: en la práctica se omiten algunas.",
     [("m7", ("11",), 2), ("m7", ("9", "11"), 2), ("7", ("13",), 2), ("7", ("9", "13"), 2), ("maj7", ("#11",), 2),
      ("maj7", ("9", "#11"), 3), ("maj7", ("13",), 3), ("maj7", ("9", "13"), 3), ("7", ("#11",), 2), ("7", ("9", "#11"), 3),
      ("7", ("9", "#11", "13"), 3), ("m7", ("13",), 3), ("m7", ("9", "11", "13"), 3), ("7", ("b13",), 3), ("7sus4", ("13",), 3)]),
    ("Dominantes alterados", "El V7 con las tensiones alteradas: máxima tensión antes de resolver.",
     [("7", ("b9", "#9"), 3), ("7", ("b9", "b13"), 3), ("7", ("#9", "b13"), 3), ("7", ("b9", "#11"), 3),
      ("7", ("b9", "#9", "#11", "b13"), 3), ("7#5", ("b9",), 3), ("7#5", ("#9",), 3), ("7b5", ("b9",), 3)]),
    ("Disminuidos y semidisminuidos con color", "Tensiones sobre los acordes disminuidos.",
     [("dim7", ("7",), 3), ("dim7", ("9",), 3), ("m7b5", ("11",), 3), ("m7b5", ("b13",), 3), ("m(maj7)", ("13",), 3)]),
]


def _voicing(root_pc: int, labels: list[str]) -> list[int]:
    """Posición cerrada desde Do3: las notas del acorde base en su octava y las tensiones (9ª, 11ª, 13ª) una octava arriba."""
    root = 48 + root_pc
    out = []
    for lab in labels:
        semis = TONES[lab][0]
        if lab in ("b9", "9", "#9", "11", "#11", "b13", "13"):
            semis += 12
        out.append(root + semis)
    return sorted(set(out))


def _entry(root: str, base_suffix: str, tensions: tuple[str, ...], level: int) -> dict:
    base = BASE_BY_SUFFIX[base_suffix]
    chord = parse_symbol(root + chord_suffix(base, tensions))
    name = base.name_es if not tensions else f"{base.name_es} con {', '.join(TONE_NAMES_ES[t] for t in tensions)}"
    shapes = guitar.chord_shapes(chord.symbol, limit=1)
    return {"symbol": chord.symbol, "name": name, "level": level, "formula": chord.labels,
            "tones": [{"label": lab, "name": TONE_NAMES_ES.get(lab, lab), "note": n} for lab, n in zip(chord.labels, chord.spelled)],
            "pcs": chord.pcs, "notes": _voicing(chord.root.pc, chord.labels), "guitar": shapes[0] if shapes else None}


def catalog(root: str = "C") -> dict:
    """Todos los acordes del diccionario sobre la fundamental `root`."""
    root = parse_symbol(root.strip() or "C").root.name  # valida y normaliza («do» no vale; «Bb» sí)
    groups = [{"name": name, "description": desc, "chords": [_entry(root, b, t, lvl) for b, t, lvl in items]}
              for name, desc, items in GROUPS]
    return {"root": root, "roots": ROOTS, "groups": groups, "total": sum(len(g["chords"]) for g in groups)}
