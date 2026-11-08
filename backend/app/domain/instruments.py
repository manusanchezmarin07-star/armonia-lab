"""Instrumentos: etiquetas de AudioSet → nombres y familias en español, y resumen por canción.

El clasificador (AST entrenado en AudioSet) devuelve probabilidades para 527
clases de sonido. Aquí se queda solo con las musicales, se traducen y se agrupan
en familias para nombrar las pistas por su contenido real.
"""
from __future__ import annotations

# etiqueta AudioSet → (nombre en español, familia)
LABELS: dict[str, tuple[str, str]] = {
    "Piano": ("piano", "teclados"), "Electric piano": ("piano eléctrico", "teclados"),
    "Keyboard (musical)": ("teclado", "teclados"), "Organ": ("órgano", "teclados"),
    "Electronic organ": ("órgano electrónico", "teclados"), "Hammond organ": ("órgano Hammond", "teclados"),
    "Synthesizer": ("sintetizador", "teclados"), "Harpsichord": ("clavecín", "teclados"),
    "Violin, fiddle": ("violín", "cuerdas frotadas"), "Cello": ("chelo", "cuerdas frotadas"),
    "Double bass": ("contrabajo", "cuerdas frotadas"), "String section": ("sección de cuerdas", "cuerdas frotadas"),
    "Bowed string instrument": ("cuerda frotada", "cuerdas frotadas"), "Orchestra": ("orquesta", "cuerdas frotadas"),
    "Pizzicato": ("pizzicato", "cuerdas frotadas"),
    "Acoustic guitar": ("guitarra acústica", "cuerdas pulsadas"), "Electric guitar": ("guitarra eléctrica", "cuerdas pulsadas"),
    "Bass guitar": ("bajo eléctrico", "cuerdas pulsadas"), "Steel guitar, slide guitar": ("guitarra slide", "cuerdas pulsadas"),
    "Ukulele": ("ukelele", "cuerdas pulsadas"), "Banjo": ("banjo", "cuerdas pulsadas"), "Mandolin": ("mandolina", "cuerdas pulsadas"),
    "Harp": ("arpa", "cuerdas pulsadas"), "Sitar": ("sitar", "cuerdas pulsadas"), "Guitar": ("guitarra", "cuerdas pulsadas"),
    "Plucked string instrument": ("cuerda pulsada", "cuerdas pulsadas"),
    "Trumpet": ("trompeta", "metales"), "Trombone": ("trombón", "metales"), "French horn": ("trompa", "metales"),
    "Brass instrument": ("metales", "metales"), "Tuba": ("tuba", "metales"),
    "Saxophone": ("saxofón", "viento madera"), "Flute": ("flauta", "viento madera"), "Clarinet": ("clarinete", "viento madera"),
    "Oboe": ("oboe", "viento madera"), "Bassoon": ("fagot", "viento madera"), "Harmonica": ("armónica", "viento madera"),
    "Accordion": ("acordeón", "viento madera"), "Wind instrument, woodwind instrument": ("viento madera", "viento madera"),
    "Singing": ("voz cantada", "voces"), "Male singing": ("voz masculina", "voces"), "Female singing": ("voz femenina", "voces"),
    "Choir": ("coro", "voces"), "Child singing": ("voz infantil", "voces"), "Rapping": ("rap", "voces"),
    "A capella": ("a capela", "voces"), "Humming": ("tarareo", "voces"), "Yodeling": ("yodel", "voces"),
    "Drum kit": ("batería", "percusión"), "Drum": ("tambor", "percusión"), "Snare drum": ("caja", "percusión"),
    "Bass drum": ("bombo", "percusión"), "Hi-hat": ("charles", "percusión"), "Cymbal": ("platos", "percusión"),
    "Percussion": ("percusión", "percusión"), "Tambourine": ("pandereta", "percusión"), "Clapping": ("palmas", "percusión"),
    "Hands": ("palmas", "percusión"), "Drum machine": ("caja de ritmos", "percusión"), "Tabla": ("tabla", "percusión"),
    "Marimba, xylophone": ("marimba", "percusión"), "Glockenspiel": ("glockenspiel", "percusión"),
    "Vibraphone": ("vibráfono", "percusión"), "Timpani": ("timbales", "percusión"), "Bongo": ("bongós", "percusión"),
    "Conga": ("congas", "percusión"), "Castanets": ("castañuelas", "percusión"),
}

FAMILY_ICON = {"teclados": "🎹", "cuerdas frotadas": "🎻", "cuerdas pulsadas": "🎸", "metales": "🎺",
               "viento madera": "🎷", "voces": "🎤", "percusión": "🥁"}

THRESHOLD = 0.12  # probabilidad mínima en una ventana para considerar que el instrumento suena


def summarize(windows: list[dict], min_share: float = 0.15) -> list[dict]:
    """Ventanas [{start, end, scores:{etiqueta: prob}}] → instrumentos presentes.

    Un instrumento cuenta si aparece en al menos `min_share` de las ventanas (o con
    mucha seguridad en alguna). Se devuelven sus tramos para dibujar dónde suena.
    """
    if not windows:
        return []
    found: dict[str, dict] = {}
    for w in windows:
        for label, p in w["scores"].items():
            if label not in LABELS or p < THRESHOLD:
                continue
            name, family = LABELS[label]
            e = found.setdefault(name, {"name": name, "family": family, "icon": FAMILY_ICON[family], "label": label,
                                        "hits": 0, "max": 0.0, "spans": []})
            e["hits"] += 1
            e["max"] = max(e["max"], p)
            if e["spans"] and abs(e["spans"][-1][1] - w["start"]) < 0.5:
                e["spans"][-1][1] = w["end"]
            else:
                e["spans"].append([w["start"], w["end"]])
    out = []
    for e in found.values():
        share = e["hits"] / len(windows)
        if share >= min_share or e["max"] >= 0.5:
            out.append({k: e[k] for k in ("name", "family", "icon", "label", "spans")} |
                       {"share": round(share, 2), "confidence": round(e["max"], 2)})
    # Si hay un nombre genérico y uno concreto de la misma familia (p. ej. «cuerda frotada»
    # y «violín»), se queda el concreto.
    generic = {"cuerda frotada", "cuerda pulsada", "metales", "viento madera", "percusión", "teclado", "guitarra", "tambor"}
    families_with_specific = {e["family"] for e in out if e["name"] not in generic}
    out = [e for e in out if not (e["name"] in generic and e["family"] in families_with_specific)]
    return sorted(out, key=lambda e: (-e["share"], -e["confidence"]))


def stem_label(stem_id: str, instruments: list[dict]) -> str:
    """Nombre de la pista según lo que contiene («Otros» → «Cuerdas: violín, chelo»)."""
    default = {"vocals": "Voz", "drums": "Batería", "bass": "Bajo", "guitar": "Guitarra", "piano": "Piano",
               "other": "Otros", "mezcla": "Mezcla original"}.get(stem_id, stem_id)
    if not instruments or stem_id == "mezcla":
        return default
    top = instruments[:3]
    families = {e["family"] for e in top}
    names = ", ".join(e["name"] for e in top)
    if len(families) == 1:
        fam = next(iter(families))
        return f"{fam.capitalize()}: {names}"
    return f"{default}: {names}" if stem_id == "other" else default + f" ({names})"
