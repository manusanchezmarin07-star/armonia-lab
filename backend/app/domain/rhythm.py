"""Compases y palos flamencos.

Solo se incluyen patrones contrastados en varias fuentes (Wikipedia "Palo (flamenco)",
"Siguiriyas" y escuelas de guitarra flamenca). Cuando las fuentes discrepan se
indica la variante, porque en flamenco hay varias formas aceptadas de contar.
"""
from __future__ import annotations

# accents: tiempos acentuados (1-based dentro del ciclo). count_start: con qué
# número se "empieza a contar" en la práctica (p. ej. la bulería suele arrancar en 12).
PALOS = [
    {
        "id": "solea", "grouping": [3, 3, 2, 2, 2], "name": "Soleá", "beats": 12, "accents": [3, 6, 8, 10, 12], "count_start": 1,
        "bpm": 70, "family": "Flamenco (ciclo de 12)",
        "description": "Ciclo de 12 tiempos con acentos en 3, 6, 8, 10 y 12: dos grupos de 3 y "
                       "tres de 2 (3+3+2+2+2). Es la base de toda la familia de 12 tiempos.",
        "sources": ["https://en.wikipedia.org/wiki/Palo_(flamenco)"],
    },
    {
        "id": "alegrias", "grouping": [3, 3, 2, 2, 2], "name": "Alegrías", "beats": 12, "accents": [3, 6, 8, 10, 12], "count_start": 12,
        "bpm": 120, "family": "Flamenco (ciclo de 12)",
        "description": "Mismo ciclo que la soleá pero en modo mayor y más rápido; se suele contar "
                       "empezando en el 12. Los acentos pueden variar entre secciones.",
        "sources": ["https://en.wikipedia.org/wiki/Palo_(flamenco)"],
    },
    {
        "id": "buleria", "grouping": [3, 3, 2, 2, 2], "name": "Bulería", "beats": 12, "accents": [3, 6, 8, 10, 12], "count_start": 12,
        "bpm": 220, "family": "Flamenco (ciclo de 12)",
        "description": "Ciclo de 12 muy rápido que se empieza a contar en el 12. Variante habitual "
                       "'a golpe' con acentos en 3, 6, 9 y 12 (ver variantes).",
        "variants": [{"name": "Acentos 3·6·9·12 (golpe)", "accents": [3, 6, 9, 12]}],
        "sources": ["https://en.wikipedia.org/wiki/Palo_(flamenco)"],
    },
    {
        "id": "seguiriya", "grouping": [2, 2, 3, 3, 2], "name": "Seguiriya (siguiriya)", "beats": 12, "accents": [1, 3, 5, 8, 11],
        "count_start": 1, "bpm": 110, "family": "Flamenco (ciclo de 12)",
        "description": "Agrupación 2+2+3+3+2: acentos en 1, 3, 5, 8 y 11 contando en 12. Muchos "
                       "flamencos la cuentan empezando en el 8 de la soleá (acentos 8-10-12-3-6), "
                       "por eso se dice que es 'una soleá que empieza a mitad'. Se siente "
                       "como 5 pulsos desiguales: corto-corto-largo-largo-corto.",
        "variants": [{"name": "Contando desde el 8 (3·6·8·10·12)", "accents": [3, 6, 8, 10, 12]}],
        "sources": ["https://en.wikipedia.org/wiki/Siguiriyas"],
    },
    {
        "id": "tangos", "grouping": [2, 2], "name": "Tangos", "beats": 4, "accents": [1, 3], "count_start": 1, "bpm": 100,
        "family": "Flamenco binario",
        "description": "Compás binario de 4 tiempos (familia de tangos, tientos, rumba).",
        "sources": ["https://en.wikipedia.org/wiki/Palo_(flamenco)"],
    },
    {
        "id": "sevillanas", "grouping": [3], "name": "Sevillanas", "beats": 3, "accents": [1], "count_start": 1, "bpm": 66,
        "family": "Folclore andaluz", "description": "Ternario (3/4).",
        "sources": ["https://en.wikipedia.org/wiki/Sevillanas"],
    },
]

METERS = [
    {"id": "4/4", "name": "4/4", "beats": 4, "accents": [1, 3], "grouping": [2, 2], "bpm": 90,
     "description": "Compás binario de subdivisión binaria: la mayoría del pop, rock y jazz."},
    {"id": "3/4", "name": "3/4", "beats": 3, "accents": [1], "grouping": [3], "bpm": 90,
     "description": "Ternario: vals, sevillanas."},
    {"id": "6/8", "name": "6/8", "beats": 6, "accents": [1, 4], "grouping": [3, 3], "bpm": 120,
     "description": "Binario de subdivisión ternaria: dos pulsos, cada uno dividido en 3."},
    {"id": "12/8", "name": "12/8", "beats": 12, "accents": [1, 4, 7, 10], "grouping": [3, 3, 3, 3], "bpm": 150,
     "description": "Cuatro pulsos ternarios: blues lento, gospel, soul."},
    {"id": "5/4", "name": "5/4 (3+2)", "beats": 5, "accents": [1, 4], "grouping": [3, 2], "bpm": 110,
     "description": "Amalgama de 3+2 (Take Five)."},
    {"id": "7/8", "name": "7/8 (2+2+3)", "beats": 7, "accents": [1, 3, 5], "grouping": [2, 2, 3], "bpm": 180,
     "description": "Compás de amalgama típico de los Balcanes; también existen 3+2+2 y 2+3+2."},
    {"id": "9/8", "name": "9/8 aksak (2+2+2+3)", "beats": 9, "accents": [1, 3, 5, 7], "grouping": [2, 2, 2, 3],
     "bpm": 200, "description": "Ritmo 'cojo' (aksak) de Turquía y los Balcanes."},
]


def grouping_from_accents(beats: int, accents: list[int]) -> list[int]:
    """Convierte acentos de fin de grupo (estilo flamenco: 3,6,8,10,12) en agrupación (3+3+2+2+2).

    En flamenco el acento cae al *final* de cada grupo, al contrario que en la
    notación clásica, donde el acento marca el inicio del compás.
    """
    acc = sorted(a for a in accents if 1 <= a <= beats)
    if not acc:
        return [beats]
    groups, prev = [], 0
    for a in acc:
        groups.append(a - prev)
        prev = a
    if prev < beats:
        groups[0] += beats - prev
    return groups


def catalog() -> dict:
    return {"palos": PALOS, "meters": METERS}
