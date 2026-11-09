"""Cómo tocar un acorde en el piano con las dos manos: reparto de notas, voicing y digitación.

La digitación es una *sugerencia* calculada, no una regla: se elige la asignación
de dedos que mejor encaja con las distancias "cómodas" entre dedos de una mano
media, que es como lo enseñan los métodos de piano (1-3-5 en tríadas cerradas,
1-2-3-5 o 1-2-4-5 en cuatriadas según los intervalos...).
"""
from __future__ import annotations

import itertools

from .chords import TONE_NAMES_ES, TONES, ParsedChord, parse_symbol
from .pitch import midi_name

STYLES = {
    "basico": "Básico: fundamental (y 5ª) en la izquierda, el acorde completo en posición cerrada en la derecha.",
    "jazz": "Jazz (shell): la izquierda toca fundamental y 7ª; la derecha, 3ª y tensiones. Suena moderno y deja hueco.",
    "abierto": "Abierto (drop 2): se baja una octava la 2ª voz más aguda; sonido amplio, de big band o coral.",
}
INVERSIONS = ["fundamental", "1ª inversión", "2ª inversión", "3ª inversión"]

# Distancia cómoda (semitonos) entre dedos vecinos de la mano derecha (1=pulgar … 5=meñique)
# y separación máxima razonable sin tensión.
_COMFORT = {(1, 2): 3.0, (2, 3): 2.0, (3, 4): 1.5, (4, 5): 1.5}
_MAX = {(1, 2): 5, (2, 3): 3, (3, 4): 3, (4, 5): 3}


def _span(a: int, b: int, table: dict) -> float:
    return sum(table[(f, f + 1)] for f in range(a, b))


def fingering(notes: list[int], hand: str) -> list[int]:
    """Dedos (1-5) para tocar `notes` (MIDI, de grave a agudo) a la vez con una mano.

    En la mano izquierda el meñique (5) toca la nota más grave, así que se calcula
    como el espejo de la derecha.
    """
    notes = sorted(notes)
    n = len(notes)
    if n == 0:
        return []
    if n == 1:
        return [1] if hand == "right" else [5]
    if n > 5:
        raise ValueError("Una mano no puede tocar más de 5 notas a la vez")
    gaps = [b - a for a, b in zip(notes, notes[1:])]
    if hand == "left":
        gaps = gaps[::-1]  # visto desde el pulgar, la mano izquierda es el espejo
    if n == 3 and notes[-1] - notes[0] <= 9:
        # Tríada cerrada: digitación de manual. 1-3-5, salvo cuando la distancia de
        # arriba (vista desde el pulgar) es una 4ª, que pide 1-2-5 (p. ej. Mi-Sol-Do).
        combo = (1, 2, 5) if gaps[1] >= 5 else (1, 3, 5)
        return list(combo) if hand == "right" else list(combo)[::-1]
    best, best_cost = None, None
    for combo in itertools.combinations(range(1, 6), n):
        cost = 0.0
        for (fa, fb), g in zip(zip(combo, combo[1:]), gaps):
            comfy = _span(fa, fb, _COMFORT)
            limit = _span(fa, fb, _MAX) if fb - fa > 1 else _MAX[(fa, fb)]
            cost += (g - comfy) ** 2
            if g > limit + (2 if fb - fa > 1 else 0):
                cost += 50 * (g - limit)  # estiramiento incómodo
        # Preferencia pedagógica: el pulgar en un extremo y, si el acorde abarca una
        # 5ª o más, el meñique en el otro (5-1 en la izquierda, 1-3-5 en la derecha).
        if combo[0] != 1:
            cost += 2
        if notes[-1] - notes[0] >= 7 and combo[-1] != 5:
            cost += 2
        if best_cost is None or cost < best_cost:
            best, best_cost = combo, cost
    fingers = list(best)
    # En la izquierda la combinación se calculó desde el pulgar (nota aguda) hacia abajo.
    return fingers if hand == "right" else fingers[::-1]


def _closed(pcs: list[int], bottom_pc: int, start: int) -> list[int]:
    """Posición cerrada empezando por `bottom_pc` desde la nota MIDI `start` hacia arriba."""
    order = sorted(pcs, key=lambda p: (p - bottom_pc) % 12)
    out, cur = [], start + ((bottom_pc - start) % 12)
    for i, p in enumerate(order):
        if i:
            cur = cur + ((p - cur) % 12 or 12)
        out.append(cur)
    return out


def two_hands(symbol: str, style: str = "basico", inversion: int = 0) -> dict:
    """Voicing a dos manos con digitación e instrucciones paso a paso."""
    if style not in STYLES:
        raise ValueError(f"Estilo desconocido: {style}")
    if not 0 <= inversion <= 3:
        raise ValueError("La inversión debe estar entre 0 (fundamental) y 3")
    c: ParsedChord = parse_symbol(symbol)
    root = c.root.pc
    labels = c.labels
    pc_label = {(root + TONES[l][0]) % 12: l for l in labels}
    has5 = "5" in labels
    seventh = next((l for l in labels if l in ("b7", "7", "bb7", "6")), None)
    bass_pc = c.bass_pc
    lh_root = 36 + bass_pc if bass_pc >= 5 else 48 + bass_pc  # Fa2..Mi3: zona cómoda de la izquierda

    if style == "jazz" and seventh:
        lh = [lh_root, lh_root + ((root + TONES[seventh][0] - bass_pc) % 12 or 12)]
        rest = [p for p in c.pcs if p % 12 not in {n % 12 for n in lh}]
        # Con muchas tensiones la 5ª sobra (no define el acorde) y la derecha se limita a 5 notas.
        if len(rest) > 5 and "5" in labels:
            rest.remove((root + 7) % 12)
        rest = rest[:5]
        rest_labels = [pc_label[p] for p in rest if p in pc_label]
        # La derecha empieza por la 3ª (o lo más grave que quede) alrededor de Do4-Mi4.
        third = next((l for l in ("3", "b3", "4", "2") if l in rest_labels), rest_labels[0] if rest_labels else None)
        rh = _closed(rest, (root + TONES[third][0]) % 12, 59) if third else []
    else:
        upper = list(dict.fromkeys(c.pcs))
        extra_lh: list[int] = []
        if len(upper) > 5:  # demasiadas notas: la 5ª (y si hace falta la fundamental) la pone la izquierda
            for drop in ("5", "1"):
                pc = (root + TONES[drop][0]) % 12
                if len(upper) > 5 and drop in labels and pc in upper:
                    upper.remove(pc)
        if len(upper) > 5 and seventh:
            # Acordes muy cargados (7alt): la 7ª pasa a la izquierda, como en un voicing shell.
            pc7 = (root + TONES[seventh][0]) % 12
            upper.remove(pc7)
            extra_lh.append(pc7)
        upper = upper[:5]
        tones_in_order = [l for l in c.base.tones if l in labels and (root + TONES[l][0]) % 12 in upper]
        inv = min(inversion, len(tones_in_order) - 1)
        bottom = (root + TONES[tones_in_order[inv]][0]) % 12 if tones_in_order else root
        rh = _closed(upper, bottom, 60 if inv == 0 else 57)
        if has5 and style == "basico" and c.base.family not in ("dim", "aug", "hdim"):
            lh = [lh_root, lh_root + ((root + 7 - bass_pc) % 12 or 12)] if bass_pc == root else [lh_root]
        else:
            lh = [lh_root, lh_root + 12] if style == "basico" else [lh_root]
        if extra_lh:
            lh = [lh_root] + [lh_root + ((p - bass_pc) % 12 or 12) for p in extra_lh]
        if style == "abierto" and len(rh) >= 4:
            second = sorted(rh)[-2]
            rh = [n for n in rh if n != second]
            lh = sorted(lh[:1] + [second - 12])
    lh, rh = sorted(set(lh)), sorted(set(rh))
    # Si las manos se cruzan se separan: primero subiendo la derecha (si cabe en el
    # registro cómodo) y si no, bajando la izquierda.
    while lh and rh and lh[-1] >= rh[0]:
        if rh[-1] + 12 <= 84:
            rh = [n + 12 for n in rh]
        else:
            lh = [n - 12 for n in lh]
    lf, rf = fingering(lh, "left"), fingering(rh, "right")

    spelled_by_pc = {(root + TONES[l][0]) % 12: n for l, n in zip(labels, c.spelled)}
    if c.bass:
        spelled_by_pc.setdefault(c.bass.pc, c.bass.name)

    def note_name(m: int) -> str:
        """Nombre deletreado según el acorde (Cb5 y no B4 en Db7), con la octava de su letra."""
        name = spelled_by_pc.get(m % 12)
        if not name:
            return midi_name(m)
        alter = name.count("#") - name.count("b")
        return f"{name}{(m - alter) // 12 - 1}"

    def describe(notes: list[int], fingers: list[int]) -> list[dict]:
        out = []
        for m, f in zip(notes, fingers):
            lab = pc_label.get(m % 12)
            out.append({"midi": m, "note": note_name(m), "finger": f,
                        "role": TONE_NAMES_ES.get(lab, "nota del bajo") if lab else "nota del bajo"})
        return out

    left, right = describe(lh, lf), describe(rh, rf)
    fmt = lambda xs: ", ".join(f"dedo {x['finger']} en {x['note']} ({x['role']})" for x in xs)  # noqa: E731
    steps = [
        {"hand": "left", "title": "Mano izquierda", "notes": lh,
         "text": f"Coloca la izquierda: {fmt(left)}." if left else "La izquierda descansa."},
        {"hand": "right", "title": "Mano derecha", "notes": rh,
         "text": f"Coloca la derecha: {fmt(right)}." if right else "La derecha descansa."},
        {"hand": "both", "title": "Las dos juntas", "notes": lh + rh,
         "text": "Toca las dos manos a la vez, sin tensión: deja caer el peso del brazo y suelta antes del siguiente acorde."},
    ]
    return {"symbol": c.symbol, "style": style, "style_description": STYLES[style],
            "inversion": INVERSIONS[min(inversion, 3)], "left": left, "right": right, "steps": steps,
            "notes": lh + rh, "spelled": c.spelled,
            # Nombre correcto de cada nota del acorde (Eb y no D#) para el pentagrama.
            "spell": {str((root + TONES[l][0]) % 12): n for l, n in zip(labels, c.spelled)}}


def arrange(symbols: list[str], style: str = "basico") -> list[dict]:
    """Voicings a dos manos para una canción entera.

    Para cada acorde se prueban sus inversiones y se elige la que obliga a mover
    menos la mano derecha desde el acorde anterior: así se toca "sin saltos",
    como lo haría un pianista, en lugar de saltar siempre a la posición fundamental.
    """
    from .voicing import movement

    cache: dict[tuple[str, int], dict] = {}

    def options(sym: str) -> list[dict]:
        out = []
        for inv in range(4 if style != "jazz" else 1):
            key = (sym, inv)
            if key not in cache:
                try:
                    cache[key] = two_hands(sym, style, inv)
                except ValueError:
                    continue
            v = cache[key]
            if not any(v["notes"] == o["notes"] for o in out):
                out.append(v)
        return out

    result: list[dict] = []
    prev_rh: list[int] | None = None
    for sym in symbols:
        opts = options(sym)
        if not opts:
            result.append({})
            continue
        if prev_rh is None:
            # Primer acorde: la posición con la derecha más centrada (alrededor de Mi4).
            best = min(opts, key=lambda v: abs(sum(x["midi"] for x in v["right"]) / len(v["right"]) - 64))
        else:
            def cost(v: dict, prev: list[int] = prev_rh) -> float:
                rh = [x["midi"] for x in v["right"]]
                drift = abs(sum(rh) / len(rh) - 64) * 0.15  # que no se vaya a los extremos poco a poco
                return movement(prev, rh) + drift
            best = min(opts, key=cost)
        prev_rh = [x["midi"] for x in best["right"]]
        result.append(best)
    return result
