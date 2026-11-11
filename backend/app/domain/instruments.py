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
    # De cada familia se queda lo más concreto: «violín» antes que «cuerda frotada», y
    # «guitarra» antes que «cuerda pulsada» (los dos son genéricos, pero uno lo es más).
    best_level = {}
    for e in out:
        best_level[e["family"]] = max(best_level.get(e["family"], 0), _level(e["name"]))
    out = [e for e in out if _level(e["name"]) == best_level[e["family"]] or _level(e["name"]) == 2]
    return sorted(out, key=lambda e: (-e["share"], -e["confidence"]))


# Nombres que solo dicen la familia (0) o un tipo amplio (1); el resto son instrumentos concretos (2).
_FAMILY_ONLY = {"cuerda frotada", "cuerda pulsada", "metales", "viento madera", "percusión", "teclado"}
_BROAD = {"guitarra", "tambor"}


def _level(name: str) -> int:
    return 0 if name in _FAMILY_ONLY else 1 if name in _BROAD else 2


DEFAULT_NAMES = {"vocals": "Voz", "drums": "Batería", "bass": "Bajo", "guitar": "Guitarra", "piano": "Piano",
                 "other": "Otros", "mezcla": "Mezcla original"}
# Qué familia cabe esperar en cada pista de Demucs. El clasificador solo matiza el
# nombre (p. ej. «Guitarra: guitarra eléctrica»); no lo contradice salvo que otra
# cosa domine claramente la pista (una flauta que Demucs ha metido en «voz»).
STEM_FAMILY = {"vocals": "voces", "drums": "percusión", "bass": "cuerdas pulsadas", "guitar": "cuerdas pulsadas", "piano": "teclados"}
# Detalles que no aportan nada al nombre de la pista (ya lo dice el propio nombre).
_REDUNDANT = {"vocals": {"voz cantada"}, "drums": {"batería", "bombo", "caja", "charles", "platos", "tambor", "percusión"},
              "bass": {"bajo eléctrico", "guitarra", "cuerda pulsada"}, "guitar": {"guitarra", "cuerda pulsada", "bajo eléctrico"},
              "piano": {"piano", "teclado"}}


def stem_label(stem_id: str, instruments: list[dict]) -> str:
    """Nombre de la pista según lo que contiene («Otros» → «Cuerdas frotadas: violín, chelo»)."""
    default = DEFAULT_NAMES.get(stem_id, stem_id)
    if not instruments or stem_id == "mezcla":
        return default
    if stem_id in STEM_FAMILY:
        fam = STEM_FAMILY[stem_id]
        own = [e["name"] for e in instruments if e["family"] == fam and e["name"] not in _REDUNDANT[stem_id]][:2]
        if own:
            return f"{default}: {', '.join(own)}"
        foreign = [e["name"] for e in instruments if e["family"] != fam and e["share"] >= 0.5 and e["confidence"] >= 0.4][:2]
        return f"{default} (suena a {', '.join(foreign)})" if foreign else default
    top = instruments[:3]
    families = {e["family"] for e in top}
    names = ", ".join(e["name"] for e in top)
    if len(families) == 1:
        return f"{next(iter(families)).capitalize()}: {names}"
    return f"{default}: {names}"


def song_instruments(stems: list[dict]) -> list[dict]:
    """Instrumentos de la canción a partir de sus pistas con contenido.

    Se fía primero de la separación (si la pista «piano» suena, hay piano) y usa el
    clasificador para concretar o para desglosar «otros». Clasificar la mezcla
    entera da peor resultado: con todo sonando a la vez casi nada destaca.
    """
    icons = {"vocals": "🎤", "drums": "🥁", "bass": "🎸", "guitar": "🎸", "piano": "🎹"}
    out: list[dict] = []
    seen: set[str] = set()

    def add(e: dict) -> None:
        if e["name"] not in seen:
            seen.add(e["name"])
            out.append(e)
    for st in stems:
        if st["id"] == "mezcla" or not st.get("active", True):
            continue
        spans = (st.get("activity") or {}).get("spans", [])
        share = (st.get("activity") or {}).get("active_ratio", 1.0)
        found = st.get("instruments") or []
        if st["id"] in STEM_FAMILY:
            fam = STEM_FAMILY[st["id"]]
            own = [e for e in found if e["family"] == fam and e["name"] not in _REDUNDANT[st["id"]]]
            if own:
                add(own[0])
            else:
                add({"name": DEFAULT_NAMES[st["id"]].lower(), "family": fam, "icon": icons[st["id"]], "label": st["id"],
                     "spans": spans, "share": round(share, 2), "confidence": 1.0})
        else:
            for e in found[:3]:
                add(e)
    return out
