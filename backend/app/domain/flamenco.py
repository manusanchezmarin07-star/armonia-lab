"""Guitarra flamenca: técnicas de rasgueo, tonos (por arriba, por medio…) y el
compás de cada palo tocado con rasgueo.

Lo que aquí se da como hecho es lo que coincide en los métodos de guitarra
flamenca: la cadencia andaluza (iv–III–II–I en el modo de Mi), que «por arriba» es
tocar en Mi y «por medio» en La, y la notación de dedos de la mano derecha
(p pulgar, i índice, m medio, a anular, c meñique). Los patrones de rasgueo sobre
cada palo son EJERCICIOS para interiorizar los acentos, no falsetas tradicionales:
cada guitarrista tiene los suyos y así se indica en la interfaz.
"""
from __future__ import annotations

from .guitar import chord_shapes
from .rhythm import PALOS


# Un golpe de la mano derecha: dedos, dirección (down = hacia el suelo) y si lleva
# golpe en la tapa (el anular toca el golpeador a la vez).
def _s(f: str, d: str | None = "down", golpe: bool = False) -> dict:
    return {"f": f, "dir": d, "golpe": golpe}


RASGUEOS = [
    {"id": "indice", "name": "Índice arriba y abajo", "strokes": [_s("i"), _s("i", "up")], "fit": 1,
     "description": "La base de todo: el índice baja con la uña (hacia el suelo) y sube con la yema. La muñeca, suelta; "
                    "el movimiento sale del dedo, no del brazo."},
    {"id": "pulgar", "name": "Pulgar", "strokes": [_s("p"), _s("p", "up")], "fit": 1,
     "description": "Rasgueo con el pulgar: hacia abajo con la uña o la yema (sonido más redondo y grave) y hacia arriba "
                    "con la uña. Es el que se usa en muchos pasajes de bulería y en la alzapúa."},
    {"id": "continuo4", "name": "Rasgueo continuo de 4 (c a m i)", "strokes": [_s("c"), _s("a"), _s("m"), _s("i")], "fit": 1,
     "description": "Los cuatro dedos salen uno detrás de otro desde el puño cerrado: meñique, anular, medio e índice. "
                    "Suena como un redoble; el último dedo (i) cae justo en el tiempo."},
    {"id": "continuo5", "name": "Rasgueo continuo de 5 (c a m i i↑)", "strokes": [_s("c"), _s("a"), _s("m"), _s("i"), _s("i", "up")], "fit": 1,
     "description": "El de 4 más el índice hacia arriba: se puede encadenar sin parar para hacer un trémolo de rasgueo."},
    {"id": "abanico", "name": "Abanico (tresillo)", "strokes": [_s("m"), _s("p"), _s("p", "up")], "fit": 1,
     "description": "Tres golpes en tresillo: un dedo hacia abajo y el pulgar abajo y arriba, girando la muñeca como un abanico. "
                    "Hay escuelas que lo hacen con i o con a en lugar de m; lo importante es que los tres suenen iguales."},
    {"id": "golpe", "name": "Golpe", "strokes": [_s("i", "down", golpe=True)], "fit": 1,
     "description": "El anular golpea el golpeador a la vez que el índice (o el pulgar) rasguea hacia abajo. Marca los acentos del compás."},
]
RASGUEOS_BY_ID = {r["id"]: r for r in RASGUEOS}

# Tonos del flamenco: la cadencia andaluza en el modo de Mi sobre cada tónica.
TONOS = [
    {"id": "arriba", "name": "Por arriba (Mi)", "tonic": "E", "cadence": ["Am", "G", "F", "E"],
     "description": "Modo de Mi con E como acorde de reposo. El F (II bemol) es la tensión que vuelve a E."},
    {"id": "medio", "name": "Por medio (La)", "tonic": "A", "cadence": ["Dm", "C", "Bb", "A"],
     "description": "El mismo modo una cuarta más arriba, en La; el Bb hace de II bemol. Típico de soleá y seguiriya."},
    {"id": "granaina", "name": "Por granaína (Si)", "tonic": "B", "cadence": ["Em", "D", "C", "B"],
     "description": "Tono de granaínas y medias granaínas. Los guitarristas suelen tocar B con cuerdas al aire (voicings propios)."},
    {"id": "taranta", "name": "Por taranta (Fa♯)", "tonic": "F#", "cadence": ["Bm", "A", "G", "F#"],
     "description": "Tono de tarantas y mineras; en la práctica se tocan con voicings abiertos muy característicos que no son los de la cadencia de manual."},
]
TONOS_BY_ID = {t["id"]: t for t in TONOS}


def catalog() -> dict:
    return {"rasgueos": RASGUEOS, "tonos": TONOS, "palos": [{"id": p["id"], "name": p["name"]} for p in PALOS]}


def _cadence(palo: dict, tono: dict) -> list[str]:
    if palo["id"] == "alegrias":  # modo mayor: tónica y dominante
        tonic = tono["tonic"]
        dom = {"E": "B7", "A": "E7", "B": "F#7", "F#": "C#7"}[tonic]
        return [tonic, tonic, dom, dom, tonic]
    return tono["cadence"]


def _chord_at(palo: dict, cad: list[str], count: int, cycle: int) -> str:
    """Acorde de un tiempo del ejercicio.

    Ciclos de 12: la cadencia andaluza repartida en los grupos del compás contados
    desde el 1 (con el I en los dos últimos grupos, para llegar al reposo hacia el 10,
    donde «cierra» el compás). Compases cortos: un acorde por ciclo.
    """
    if palo["beats"] < 12:
        return cad[cycle % len(cad)]
    edge = 0
    for g, size in enumerate(palo["grouping"]):
        edge += size
        if count <= edge:
            return cad[min(g, len(cad) - 1)]
    return cad[-1]


def _beat_strokes(accent: bool, style: str) -> list[dict]:
    if style == "pulgar":
        return [_s("p", "down", golpe=accent)]
    if accent and style == "continuo":
        return [dict(s) for s in RASGUEOS_BY_ID["continuo4"]["strokes"]]
    if accent and style == "abanico":
        return [dict(s) for s in RASGUEOS_BY_ID["abanico"]["strokes"]]
    # Básico: acento = rasgueo con golpe; tiempo débil = índice abajo y arriba suave.
    return [_s("i", "down", golpe=True)] if accent else [_s("i"), _s("i", "up")]


COMPAS_STYLES = {
    "basico": "Básico: golpe en los acentos, índice ↓↑ en el resto",
    "continuo": "Rasgueo continuo (c a m i) en los acentos",
    "abanico": "Abanico en los acentos",
    "pulgar": "Solo pulgar (con golpe en los acentos)",
}


def compas(palo_id: str, tono_id: str = "arriba", style: str = "basico", capo: int = 0) -> dict:
    """Un ciclo del palo tocado con rasgueo: por tiempo, si es acento, los golpes y el
    acorde, más la posición de cada acorde en el mástil (con la cejilla indicada)."""
    palo = next((p for p in PALOS if p["id"] == palo_id), None)
    if palo is None:
        raise ValueError(f"Palo desconocido: {palo_id}")
    tono = TONOS_BY_ID.get(tono_id)
    if tono is None:
        raise ValueError(f"Tono desconocido: {tono_id}")
    if style not in COMPAS_STYLES:
        raise ValueError(f"Estilo desconocido: {style}")
    cad = _cadence(palo, tono)
    n = palo["beats"]
    start = palo.get("count_start", 1)
    cycles = 1 if n >= 12 else 4  # en compases cortos, la cadencia completa ocupa 4 ciclos
    beats = []
    for k in range(n * cycles):
        num = (start - 1 + k) % n + 1  # número que se dice al contar (la bulería empieza en 12)
        accent = num in palo["accents"]
        beats.append({"index": k, "count": num, "accent": accent, "chord": _chord_at(palo, cad, num, k // n),
                      "strokes": _beat_strokes(accent, style)})
    chords = [b["chord"] for b in beats]
    shapes = {}
    for c in dict.fromkeys(chords):
        found = chord_shapes(c, capo=capo, limit=1)
        shapes[c] = found[0] if found else None
    return {"palo": {k: palo[k] for k in ("id", "name", "beats", "accents", "grouping", "bpm")}, "tono": tono, "style": style,
            "styles": COMPAS_STYLES, "capo": capo, "beats": beats, "shapes": shapes,
            "note": "Ejercicio para interiorizar el compás: los acentos y la cadencia son los del palo, "
                    "pero el reparto de acordes y golpes es didáctico; los guitarristas lo varían."}
