"""Guitarra: afinación, mástil y búsqueda de posiciones de acordes con digitación.

Convenciones: las cuerdas se numeran como los guitarristas, de la 6ª (Mi grave) a
la 1ª (Mi agudo), pero en las listas van de la 6ª a la 1ª (índice 0 = 6ª cuerda),
que es como se leen los diagramas de acordes (x32010 = Do mayor).
Trastes: -1 = cuerda apagada (x), 0 = al aire. Dedos: 1 índice, 2 medio,
3 anular, 4 meñique, 0 = al aire o sin dedo.

La búsqueda genera todas las combinaciones de notas del acorde dentro de una
ventana de 4 trastes, descarta lo intocable (más de 4 dedos, estiramientos,
cuerdas apagadas en medio) y ordena por facilidad y sonoridad.
"""
from __future__ import annotations

import functools
import itertools
import json
from dataclasses import dataclass

from .chords import TONE_NAMES_ES, TONES, ParsedChord, parse_symbol
from .pitch import midi_name

STANDARD = (40, 45, 50, 55, 59, 64)  # Mi2 La2 Re3 Sol3 Si3 Mi4
STRING_NAMES = ("6ª (Mi grave)", "5ª (La)", "4ª (Re)", "3ª (Sol)", "2ª (Si)", "1ª (Mi agudo)")
FRETS = 19  # una guitarra clásica tiene 19 trastes
ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"]


@dataclass
class Shape:
    frets: tuple[int, ...]
    fingers: tuple[int, ...]
    barre: dict | None
    score: float


def _contiguous(strings: list[int], frets: tuple[int, ...], fret: int) -> bool:
    """Una mini-cejilla solo puede pisar cuerdas seguidas sin otras notas más bajas en medio."""
    return all(frets[s] >= fret for s in range(min(strings), max(strings) + 1))


def _notes_of(frets: tuple[int, ...], tuning: tuple[int, ...]) -> list[int]:
    return [tuning[s] + f for s, f in enumerate(frets) if f >= 0]


def assign_fingers(frets: tuple[int, ...]) -> tuple[tuple[int, ...], dict | None] | None:
    """Dedos de la mano izquierda para una posición, o None si no se puede tocar.

    Regla de los métodos de guitarra: un dedo por traste a partir del traste más
    bajo pisado (el índice en ese traste). Si varias cuerdas comparten el traste
    más bajo y no caben con dedos sueltos, el índice hace cejilla.
    """
    pressed = [(s, f) for s, f in enumerate(frets) if f > 0]
    fingers = [0] * len(frets)
    if not pressed:
        return tuple(fingers), None
    low = min(f for _, f in pressed)
    high = max(f for _, f in pressed)
    if high - low > 3:
        return None
    at_low = [s for s, f in pressed if f == low]
    others = [(s, f) for s, f in pressed if f > low]
    barre = None
    # Sin cejilla: cada nota necesita su dedo (máximo 4).
    if len(pressed) <= 4:
        order = sorted(pressed, key=lambda x: (x[1], x[0]))
        used = 0
        ok = True
        prev_fret = None
        for s, f in order:
            # Dedo mínimo según la distancia al traste más bajo (no se puede "cruzar" dedos).
            used = max(used + 1, f - low + 1) if prev_fret is not None else f - low + 1
            if used > 4:
                ok = False
                break
            fingers[s] = used
            prev_fret = f
        if ok:
            return tuple(fingers), None
    # Con cejilla: el índice pisa todas las cuerdas desde la más grave del traste bajo
    # hasta la 1ª; ninguna de esas cuerdas puede estar al aire (la cejilla la taparía).
    first = min(at_low)
    if any(frets[s] == 0 for s in range(first, len(frets))):
        return None
    for s in range(len(frets)):
        if frets[s] == low and s >= first:
            fingers[s] = 1
    # Notas por encima de la cejilla, agrupadas por traste. Si tres cuerdas comparten
    # traste y no quedan dedos sueltos, el anular hace una "mini-cejilla" (forma de La
    # con cejilla: x13331 → 1 3 3 3 1), como se enseña en los métodos.
    by_fret: dict[int, list[int]] = {}
    for s, f in others:
        by_fret.setdefault(f, []).append(s)
    used = 1
    for f in sorted(by_fret):
        strings = sorted(by_fret[f])
        free = 4 - used
        if len(strings) <= free:
            for s in strings:
                used += 1
                fingers[s] = used
        elif free >= 1 and _contiguous(strings, frets, f):
            used += 1
            for s in strings:
                fingers[s] = used
        else:
            return None
        if used > 4:
            return None
    barre = {"fret": low, "from_string": 6 - first, "to_string": 1 if len(at_low) > 1 or first < 5 else 6 - first}
    return tuple(fingers), barre


def _score(frets: tuple[int, ...], chord: ParsedChord, tuning: tuple[int, ...], barre: dict | None) -> float | None:
    """Facilidad y sonoridad de una posición (más alto = mejor) o None si no vale."""
    sounding = [s for s, f in enumerate(frets) if f >= 0]
    if len(sounding) < 3:
        return None
    notes = _notes_of(frets, tuning)
    pcs = {n % 12 for n in notes}
    # Notas imprescindibles: fundamental, 3ª (o 2ª/4ª en sus) y 7ª/6ª; la 5ª es opcional.
    essential = {(chord.root.pc + TONES[t][0]) % 12 for t in chord.labels if t not in ("5",)}
    tensions = {(chord.root.pc + TONES[t][0]) % 12 for t in chord.tensions}
    missing = essential - pcs - tensions
    if missing:
        return None
    if min(notes) % 12 != chord.bass_pc:
        return None
    # Cuerdas apagadas entre cuerdas que suenan: posibles, pero incómodas para rasguear.
    inner_mutes = sum(1 for s in range(sounding[0], sounding[-1]) if frets[s] < 0)
    pressed = [f for f in frets if f > 0]
    low = min(pressed) if pressed else 0
    score = 10.0
    score += 1.2 * len(sounding)
    score += 0.8 * sum(1 for f in frets if f == 0)        # cuerdas al aire: más fácil y resonante
    score -= 0.35 * low                                    # posiciones altas, algo más difíciles
    score -= 4.0 * inner_mutes
    # En los acordes de manual solo se apagan cuerdas graves (x32010, xx0232): apagar
    # agudas por encima de cuerdas que suenan obliga a una mano rara al rasguear.
    score -= 3.0 * sum(1 for s in range(sounding[-1] + 1, len(frets)))
    # Cuerdas al aire intercaladas entre trastes altos (x20402): hay que arquear los dedos
    # por encima de ellas; con trastes bajos (Do mayor, x32010) es lo normal.
    if pressed and max(pressed) >= 4:
        score -= 2.0 * sum(1 for st in range(sounding[0] + 1, sounding[-1]) if frets[st] == 0
                           and any(frets[a] > 0 for a in range(st)) and any(frets[b] > 0 for b in range(st + 1, len(frets))))
    # Cuerdas al aire mezcladas con posiciones altas (878080): sonido extraño y difícil.
    if low >= 5:
        score -= 1.5 * sum(1 for f in frets if f == 0)
    score -= 2.0 if barre else 0.0
    score -= 0.6 * (max(pressed) - low if pressed else 0)  # estiramiento
    score += 0.5 * len(pcs & tensions)
    # Duplicar la 3ª en el registro grave suena "embarrado": se penaliza levemente.
    third = next(((chord.root.pc + TONES[t][0]) % 12 for t in ("3", "b3") if t in chord.labels), None)
    if third is not None and sum(1 for n in notes if n % 12 == third and n < 55) > 1:
        score -= 1.0
    return score


def chord_shapes(symbol: str, capo: int = 0, limit: int = 8, tuning: tuple[int, ...] = STANDARD,
                 max_fret: int = 15) -> list[dict]:
    """Posiciones tocables de un acorde, ordenadas de más fácil a más difícil.

    `capo` (cejilla mecánica) sube todas las cuerdas: los trastes devueltos son
    relativos a la cejilla, como se leen en un cancionero con «cejilla en II».
    """
    # La búsqueda prueba miles de combinaciones (décimas de segundo) y la app pide las
    # mismas posiciones una y otra vez (cada mástil, cada tarjeta): se guarda en caché.
    # Se cachea como JSON para devolver siempre una copia que el llamante pueda modificar.
    return json.loads(_shapes_json(symbol, capo, limit, tuning, max_fret))


@functools.lru_cache(maxsize=4096)
def _shapes_json(symbol: str, capo: int, limit: int, tuning: tuple[int, ...], max_fret: int) -> str:
    return json.dumps(_search_shapes(symbol, capo, limit, tuning, max_fret))


def _search_shapes(symbol: str, capo: int, limit: int, tuning: tuple[int, ...], max_fret: int) -> list[dict]:
    if not 0 <= capo <= 12:
        raise ValueError("La cejilla debe estar entre el traste 0 y el 12")
    chord = parse_symbol(symbol)
    open_tuning = tuple(t + capo for t in tuning)
    pcs = set(chord.pcs) | {chord.bass_pc}
    # Notas que no pueden faltar (las mismas que exige _score): todo menos la 5ª y las tensiones.
    tension_pcs = {(chord.root.pc + TONES[t][0]) % 12 for t in chord.tensions}
    essential = {(chord.root.pc + TONES[t][0]) % 12 for t in chord.labels if t not in ("5",)} - tension_pcs
    found: dict[tuple[int, ...], Shape] = {}
    for start in range(0, max_fret - capo - 2):
        window = range(max(1, start), start + 4)
        options = []
        for s in range(6):
            opts = [-1]
            if open_tuning[s] % 12 in pcs:
                opts.append(0)
            opts += [f for f in window if (open_tuning[s] + f) % 12 in pcs]
            options.append(opts)
        for frets in itertools.product(*options):
            if frets in found:
                continue
            # Descartes baratos antes de calcular la digitación (lo más caro): la gran mayoría
            # de las combinaciones no tiene las notas imprescindibles o el bajo correcto.
            sounding = [open_tuning[st] + f for st, f in enumerate(frets) if f >= 0]
            if len(sounding) < 3 or min(sounding) % 12 != chord.bass_pc:
                continue
            if essential - {n % 12 for n in sounding}:
                continue
            fing = assign_fingers(frets)
            if fing is None:
                continue
            fingers, barre = fing
            sc = _score(frets, chord, open_tuning, barre)
            if sc is None:
                continue
            found[frets] = Shape(frets, fingers, barre, sc)
    shapes = sorted(found.values(), key=lambda x: -x.score)
    # Variedad: no devolver diez variantes casi iguales de la misma zona del mástil.
    chosen: list[Shape] = []
    for sh in shapes:
        pos = _position(sh.frets)
        if sum(1 for c in chosen if abs(_position(c.frets) - pos) <= 1) >= 2:
            continue
        chosen.append(sh)
        if len(chosen) >= limit:
            break
    out = [_describe(sh, chord, open_tuning, capo) for sh in chosen]
    # Con cejilla, el guitarrista piensa en la forma que hace (con cejilla en III, un Bb
    # se toca «con forma de Sol»); el nombre del acorde y las notas siguen siendo lo que suena.
    shape_of = chord.symbol
    if capo:
        from .transpose import transpose
        shape_of = transpose(chord.symbol, semitones=-capo)["chords"][0]
    for d in out:
        d["shape_of"] = shape_of
    return out


def _position(frets: tuple[int, ...]) -> int:
    pressed = [f for f in frets if f > 0]
    return min(pressed) if pressed else 0


def _describe(sh: Shape, chord: ParsedChord, tuning: tuple[int, ...], capo: int) -> dict:
    pc_label = {(chord.root.pc + TONES[l][0]) % 12: l for l in chord.labels}
    spelled = {(chord.root.pc + TONES[l][0]) % 12: n for l, n in zip(chord.labels, chord.spelled)}
    notes = []
    for s, f in enumerate(sh.frets):
        if f < 0:
            continue
        m = tuning[s] + f
        lab = pc_label.get(m % 12)
        name = spelled.get(m % 12)
        notes.append({"string": 6 - s, "fret": f, "midi": m,
                      "note": f"{name}{(m - (name.count('#') - name.count('b'))) // 12 - 1}" if name else midi_name(m),
                      "role": TONE_NAMES_ES.get(lab, "bajo") if lab else "bajo", "finger": sh.fingers[s]})
    pos = _position(sh.frets)
    is_open = any(f == 0 for f in sh.frets) and pos <= 4
    name = ("posición abierta" if is_open else f"traste {ROMAN[pos] if pos < len(ROMAN) else pos}") + \
        (f", cejilla en {ROMAN[sh.barre['fret']]}" if sh.barre else "")
    base = 1 if max(sh.frets) <= 4 else pos
    return {"symbol": chord.symbol, "frets": list(sh.frets), "fingers": list(sh.fingers), "barre": sh.barre,
            "base_fret": base, "position": pos, "name": name, "capo": capo, "notes": notes, "score": round(sh.score, 2),
            "diagram": "".join("x" if f < 0 else (str(f) if f < 10 else f"({f})") for f in sh.frets)}


def fretboard(pcs: list[int], root_pc: int | None = None, frets: int = 15, tuning: tuple[int, ...] = STANDARD,
              capo: int = 0) -> list[dict]:
    """Todas las casillas del mástil que pertenecen a un conjunto de notas (escala o acorde)."""
    target = {p % 12 for p in pcs}
    out = []
    for s in range(6):
        for f in range(0, frets + 1):
            m = tuning[s] + capo + f
            if m % 12 in target:
                out.append({"string": 6 - s, "fret": f, "midi": m, "pc": m % 12, "root": m % 12 == root_pc})
    return out


def _shape_for(symbol: str, capo: int) -> list[dict]:
    """Posiciones del acorde tal y como se pisan con la cejilla puesta (trastes relativos
    a la cejilla y notas como suenan; `shape_of` dice qué forma se hace)."""
    symbol = symbol.strip()
    if not symbol:
        raise ValueError("Acorde vacío")
    shapes = chord_shapes(symbol, capo=capo, limit=6)
    for s in shapes:
        s["sounds_as"] = s["symbol"]
    return shapes


def suggest_capo(symbols: list[str], max_capo: int = 7) -> list[dict]:
    """Cejillas posibles ordenadas por facilidad: media de la mejor posición de cada acorde
    (con penalización si alguno exige cejilla con el dedo). Igual que buscaría un guitarrista
    la cejilla que deja la canción en formas de Do, Sol, Re, La o Mi."""
    uniq = list(dict.fromkeys(s.strip() for s in symbols if s and s.strip() and s.strip() != "N"))
    out = []
    for capo in range(0, max_capo + 1):
        tops, barres, names = [], 0, []
        for sym in uniq:
            try:
                shapes = _shape_for(sym, capo)
            except ValueError:
                continue
            if not shapes:
                tops.append(0.0)
                names.append(sym)
                continue
            tops.append(shapes[0]["score"])
            names.append(shapes[0]["shape_of"])
            barres += 1 if shapes[0]["barre"] else 0
        if not tops:
            continue
        ease = sum(tops) / len(tops) - 1.5 * barres / max(1, len(uniq)) - 0.3 * capo
        out.append({"capo": capo, "ease": round(ease, 2), "barre_chords": barres, "shapes": names})
    return sorted(out, key=lambda c: -c["ease"])


def arrange_song(symbols: list[str], capo: int = 0) -> list[dict]:
    """Una posición por acorde, encadenadas para mover poco la mano (como `hands.arrange` en piano)."""
    result: list[dict] = []
    prev_pos: float | None = None
    cache: dict[str, list[dict]] = {}
    for sym in symbols:
        if not sym or sym == "N":
            result.append({})
            continue
        if sym not in cache:
            try:
                cache[sym] = _shape_for(sym, capo)
            except ValueError:
                cache[sym] = []
        opts = cache[sym]
        if not opts:
            result.append({})
            continue
        if prev_pos is None:
            best = opts[0]
        else:
            # Facilidad de la posición menos el salto de la mano por el mástil.
            best = max(opts, key=lambda s: s["score"] - 0.9 * abs(s["position"] - prev_pos))
        prev_pos = best["position"]
        result.append(best)
    return result


def voicing_for_notes(notes: list[int]) -> dict | None:
    """Cómo se toca en guitarra un acorde dado como notas (p. ej. un voicing de piano).

    Las mismas notas en las mismas octavas rara vez son cómodas en el mástil: un
    Cmaj7 cerrado de piano queda en diagonal por el traste 8. Aquí se reconoce el
    acorde y se devuelve su posición de guitarra más natural, respetando el bajo
    si eso no la complica demasiado. None si las notas no forman un acorde.
    """
    from .chords import identify
    if len({n % 12 for n in notes}) < 3:
        return None
    for reading in identify(notes)[:3]:
        try:
            with_bass = chord_shapes(reading.symbol, limit=1)
            plain = chord_shapes(reading.symbol.split("/")[0], limit=1) if "/" in reading.symbol else []
        except ValueError:
            continue
        # La inversión exacta solo si no cuesta mucho más que la posición fundamental.
        best = with_bass[0] if with_bass and (not plain or with_bass[0]["score"] >= plain[0]["score"] - 3) else (plain[0] if plain else None)
        if best:
            return best
    return None
