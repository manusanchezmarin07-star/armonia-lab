"""Letra sincronizada y hoja de letra con acordes (cancionero).

Tres formas de obtener los tiempos de cada palabra, de más a menos precisa:
1. Transcripción automática (Whisper) de la pista de voz: tiempos por palabra.
2. Letra pegada por el usuario + transcripción: se alinean ambas (la letra del
   usuario manda en el texto; la transcripción aporta los tiempos).
3. Letra pegada sin transcripción: cada verso se asigna a una "frase" de la voz
   (tramos con voz detectados por energía en la pista separada).
"""
from __future__ import annotations

import difflib
import re
import unicodedata

Word = dict  # {"text": str, "start": float, "end": float}
Line = dict  # {"start": float, "end": float, "words": list[Word]}


def _norm(w: str) -> str:
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^\w]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))


def split_lyrics(text: str) -> list[list[str]]:
    """Letra pegada → versos (líneas no vacías) → palabras."""
    return [line.split() for line in text.splitlines() if line.strip()]


def lines_from_asr(segments: list[dict]) -> list[Line]:
    """Segmentos de Whisper ({start, end, words:[{word,start,end}]}) → versos."""
    out = []
    for seg in segments:
        words = [{"text": w["word"].strip(), "start": float(w["start"]), "end": float(w["end"])}
                 for w in seg.get("words", []) if w["word"].strip()]
        if words:
            out.append({"start": words[0]["start"], "end": words[-1]["end"], "words": words})
    return out


def align_to_asr(text: str, asr_words: list[Word]) -> list[Line]:
    """Alinea la letra pegada con las palabras transcritas.

    Se emparejan palabra a palabra (difflib sobre versiones normalizadas, sin
    tildes ni signos). Las palabras emparejadas toman el tiempo de la transcripción;
    las demás se interpolan entre sus vecinas emparejadas.
    """
    lines = split_lyrics(text)
    flat = [w for line in lines for w in line]
    if not flat:
        return []
    a = [_norm(w) for w in flat]
    b = [_norm(w["text"]) for w in asr_words]
    times: list[tuple[float, float] | None] = [None] * len(flat)
    for blk in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            w = asr_words[blk.b + k]
            times[blk.a + k] = (w["start"], w["end"])
    _interpolate(times, end_hint=asr_words[-1]["end"] if asr_words else 0.0)
    out, k = [], 0
    for line in lines:
        words = []
        for w in line:
            st, en = times[k]  # type: ignore[misc]
            words.append({"text": w, "start": round(st, 3), "end": round(en, 3)})
            k += 1
        out.append({"start": words[0]["start"], "end": words[-1]["end"], "words": words})
    return out


def _interpolate(times: list, end_hint: float) -> None:
    """Rellena los huecos (None): cada tramo de palabras sin tiempo se reparte a partes
    iguales entre el final de la palabra conocida anterior y el inicio de la siguiente."""
    n = len(times)
    if all(t is None for t in times):
        span = end_hint or float(n) * 0.4
        for i in range(n):
            times[i] = (span * i / n, span * (i + 1) / n)
        return
    i = 0
    while i < n:
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < n and times[j] is None:
            j += 1
        m = j - i  # palabras sin tiempo en [i, j)
        lo = times[i - 1][1] if i > 0 else max(0.0, times[j][0] - 0.4 * m)
        hi = times[j][0] if j < n else lo + 0.4 * m
        if hi <= lo:
            hi = lo + 0.2 * m
        for k in range(m):
            times[i + k] = (lo + (hi - lo) * k / m, lo + (hi - lo) * (k + 1) / m)
        i = j


def distribute_to_phrases(text: str, phrases: list[tuple[float, float]], duration: float) -> list[Line]:
    """Sin transcripción: cada verso va a una frase vocal (en orden) y sus palabras se
    reparten en ella según su longitud. Si sobran versos, se dividen las frases largas."""
    lines = split_lyrics(text)
    if not lines:
        return []
    spans = list(phrases) or [(0.0, duration)]
    # Ajustar el número de tramos al de versos: partir el más largo o unir los más cortos.
    while len(spans) < len(lines):
        k = max(range(len(spans)), key=lambda i: spans[i][1] - spans[i][0])
        a, b = spans[k]
        spans[k:k + 1] = [(a, (a + b) / 2), ((a + b) / 2, b)]
    while len(spans) > len(lines):
        k = min(range(len(spans) - 1), key=lambda i: spans[i + 1][0] - spans[i][1])
        spans[k:k + 2] = [(spans[k][0], spans[k + 1][1])]
    out = []
    for words, (a, b) in zip(lines, spans):
        weights = [max(1, len(w)) for w in words]
        total = sum(weights)
        t, ws = a, []
        for w, wt in zip(words, weights):
            d = (b - a) * wt / total
            ws.append({"text": w, "start": round(t, 3), "end": round(t + d, 3)})
            t += d
        out.append({"start": ws[0]["start"], "end": ws[-1]["end"], "words": ws})
    return out


def build_sheet(lines: list[Line], segments: list[dict], duration: float) -> list[dict]:
    """Hoja de cancionero: cada verso con el acorde puesto sobre la palabra en la que cambia.

    Los cambios de acorde que caen entre versos (introducciones, interludios) se
    agrupan en líneas instrumentales para que no se pierda ningún acorde.
    """
    changes = [s for s in segments if s.get("symbol") and s["symbol"] != "N"]
    sheet: list[dict] = []
    used: set[int] = set()

    def instrumental(a: float, b: float):
        ch = [(i, c) for i, c in enumerate(changes) if a <= c["start"] < b and i not in used]
        if ch:
            used.update(i for i, _ in ch)
            sheet.append({"type": "instrumental", "start": ch[0][1]["start"], "end": b,
                          "chords": [{"symbol": c["symbol"], "time": c["start"], "segment": segments.index(c)} for _, c in ch]})

    prev_end = 0.0
    for line_index, line in enumerate(lines):
        # Un acorde que empieza un poco antes del verso (anacrusa) pertenece al verso.
        instrumental(prev_end, line["start"] - 0.35)
        words = [dict(w, chord=None) for w in line["words"]]
        # El acorde vigente al empezar el verso se escribe sobre la primera palabra.
        current = next((i for i, c in enumerate(changes) if c["start"] <= line["start"] < c["end"]), None)
        if current is not None and current not in used:
            words[0]["chord"] = {"symbol": changes[current]["symbol"], "segment": segments.index(changes[current])}
            used.add(current)
        for i, c in enumerate(changes):
            if i in used or not (line["start"] - 0.35 <= c["start"] < line["end"]):
                continue
            target = next((w for w in words if w["start"] >= c["start"] - 0.25), words[-1])
            if target["chord"] is None:
                target["chord"] = {"symbol": c["symbol"], "segment": segments.index(c)}
            else:  # dos cambios sobre la misma palabra: se encadenan
                target["chord"]["symbol"] += " " + c["symbol"]
            used.add(i)
        # "line" es el índice real del verso: tras reordenar por tiempo (un verso adelantado
        # puede quedar antes que el anterior) la posición en la hoja ya no coincide.
        sheet.append({"type": "verse", "line": line_index, "start": line["start"], "end": line["end"], "words": words})
        prev_end = line["end"]
    instrumental(prev_end, duration + 1)
    sheet.sort(key=lambda r: r["start"])
    return sheet
