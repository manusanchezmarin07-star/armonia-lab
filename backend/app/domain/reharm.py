"""Rearmonización: qué otros acordes pueden ocupar el lugar de uno dado.

Es la herramienta central para entender a arreglistas como Jacob Collier: casi
todos sus "cambios imposibles" son combinaciones de unas pocas sustituciones
(sustituto tritonal, dominante negativa, mediantes cromáticas, préstamo modal,
disminuidos...) elegidas para que las voces se muevan lo mínimo.

Cada sustitución devuelve el acorde, la regla que la justifica y una medida de
cuánto se parece (notas comunes) al original.
"""
from __future__ import annotations

from .chords import BASE_BY_SUFFIX, TONES, ParsedChord, chord_suffix, parse_progression, parse_symbol
from .keys import Key, analyze_chord_in_key, negative_pc
from .pitch import pc_name
from .voicing import Step, realize

# Pool de acordes candidatos para rearmonizar una nota de la melodía.
MELODY_TYPES = ["maj7", "6", "7", "m7", "m6", "m7b5", "dim7", "7sus4", "m(maj7)", "maj7#5"]


def _root_name(key: Key, pc: int) -> str:
    """Nombre de la fundamental coherente con la tonalidad (Bb en Fa mayor, A# en Si mayor)."""
    for n in key.scale:
        if n.pc == pc % 12:
            return n.name
    return pc_name(pc, key.accidental_preference)


def _sym(key: Key, root_pc: int, suffix: str, tensions: tuple[str, ...] = ()) -> str:
    return _root_name(key, root_pc) + chord_suffix(BASE_BY_SUFFIX[suffix], tensions)


def _common(a: ParsedChord, b: ParsedChord) -> list[str]:
    return [pc_name(p) for p in sorted(set(a.pcs) & set(b.pcs))]


def melody_role(chord: ParsedChord, melody_pc: int) -> dict:
    """Papel de la nota de la melodía dentro del acorde: nota del acorde, tensión o nota a evitar."""
    rel = (melody_pc - chord.root.pc) % 12
    for label in chord.labels:
        if TONES[label][0] == rel:
            return {"role": "nota del acorde" if label in chord.base.tones else "tensión", "label": label, "ok": True}
    for label in chord.base.allowed_tensions:
        if TONES[label][0] == rel:
            return {"role": "tensión disponible", "label": label, "ok": True}
    # Nota a evitar: choca medio tono por encima de una nota del acorde (p. ej. la 11ª sobre maj7).
    clashes = any((melody_pc - p) % 12 == 1 for p in chord.pcs)
    return {"role": "nota a evitar" if clashes else "nota ajena", "label": None, "ok": False}


def substitutes(symbol: str, key_text: str, next_symbol: str | None = None, melody: str | None = None) -> dict:
    """Lista de sustituciones posibles para `symbol` en `key_text`.

    Si se da `next_symbol`, se mide lo suave que es ir de cada sustituto al acorde
    siguiente. Si se da `melody` (nota), se indica si la melodía encaja en cada uno.
    """
    key = Key.parse(key_text)
    orig = parse_symbol(symbol)
    nxt = parse_symbol(next_symbol) if next_symbol else None
    mel_pc = parse_symbol(melody).root.pc if melody else None
    info = analyze_chord_in_key(key, orig.root.pc, orig.base.suffix, orig.pcs)
    r = orig.root.pc
    fam = orig.base.family
    T = key.tonic.pc
    cands: list[tuple[str, str, str]] = []  # (símbolo, técnica, explicación)

    def add(sym: str, tech: str, why: str):
        cands.append((sym, tech, why))

    # 1. Sustitutos diatónicos con la misma función (comparten 2-3 notas).
    if info["kind"] == "diatónico":
        for ch in key.diatonic_chords(True):
            shared = set(ch["pcs"]) & set(orig.pcs)
            if ch["root_pc"] != r and len(shared) >= 2 and ch["function"] == info["function"]:
                add(ch["symbol"], "Sustituto diatónico", f"{ch['symbol']} ({ch['roman']}) tiene la misma función "
                    f"({ch['function_es'].split(' (')[0].lower()}) y comparte {len(shared)} notas con {orig.symbol}.")

    # 2. Dominantes: tritono, backdoor, disminuido, sus, alteraciones.
    if fam == "dom":
        add(_sym(key, r + 6, "7"), "Sustituto tritonal", "Comparte el tritono (3ª y 7ª) y resuelve bajando medio tono: "
            "el bajo hace un cromatismo.")
        target = (r + 5) % 12
        add(_sym(key, target - 2, "7"), "Dominante 'backdoor' (bVII7)", "Viene del modo menor paralelo del destino y "
            "llega a la tónica subiendo un tono: sonido góspel/soul.")
        add(_sym(key, r + 4, "dim7"), "Disminuido (V7b9 sin fundamental)", "Las 4 notas superiores de un 7(b9) forman un "
            "acorde disminuido: misma tensión, resolución por semitono en todas las voces.")
        add(_sym(key, r, "7sus4", ("9",)), "Dominante suspendido", "Retrasa la 3ª: tensión más abierta y moderna "
            "(muy usado en jazz modal y góspel).")
        add(_sym(key, r, "7", ("b9", "#9", "#11", "b13")), "Dominante alterado", "Todas las tensiones alteradas: "
            "máxima tensión antes de resolver (escala alterada).")
        add(_sym(key, r - 2, "") + "/" + _root_name(key, r), "IV/V (acorde sobre bajo)", "Un acorde de subdominante sobre el "
            "bajo del dominante: dominante suave, sin tritono, típico del pop y el góspel.")

    # 3. Armonía negativa: reflejo del acorde respecto a la tónica.
    neg_pcs = {negative_pc(p, T) for p in orig.pcs}
    for cand_root in sorted(neg_pcs):
        for suf in ("m6", "m7b5", "m7", "maj7", "7", "", "m", "dim7", "6"):
            base_pcs = {(cand_root + TONES[t][0]) % 12 for t in BASE_BY_SUFFIX[suf].tones}
            if base_pcs == neg_pcs:
                add(_sym(key, cand_root, suf), "Armonía negativa", f"Reflejo exacto de {orig.symbol} sobre el eje de "
                    f"{key.tonic.name}: misma función con el color invertido (mayor ↔ menor).")
                break

    # 4. Préstamo modal y mediantes cromáticas para acordes de tónica o subdominante.
    if fam in ("maj", "min") and info["function"] in ("T", "S", None):
        other = "m7" if fam == "maj" else "maj7"
        add(_sym(key, r, other), "Cambio de modo", "Misma fundamental, modo contrario: el color cambia de golpe "
            "manteniendo el bajo (intercambio modal).")
        for shift, name in ((3, "bIII"), (8, "bVI"), (4, "III"), (9, "VI")):
            add(_sym(key, r + shift, "maj7"), f"Mediante cromática ({name})", "Fundamental a distancia de 3ª y mismo tipo "
                "de acorde: cambio cinematográfico que comparte una nota con el original.")
    if info["function"] == "S" or (fam == "maj" and (r - T) % 12 == 5):
        add(_sym(key, T + 5, "m6"), "iv menor (préstamo)", "El IV en menor (del modo paralelo): melancólico y resuelve a "
            "la tónica con la 6ª bajando medio tono.")
        add(_sym(key, T + 1, "maj7"), "Napolitano (bII)", "Subdominante cromática: muy expresiva, suele ir al V.")

    # 5. Preparaciones: acordes que se pueden insertar ANTES del original para tonicizarlo.
    if fam in ("maj", "min", "dom"):
        add(_sym(key, r + 7, "7") + " → " + orig.symbol, "Preparar con su V7", f"Insertar el dominante de {orig.symbol} "
            "justo antes: lo convierte en un pequeño destino (tonicización).")
        ii_suffix = "m7" if fam != "min" else "m7b5"
        add(_sym(key, r + 2, ii_suffix) + " " + _sym(key, r + 7, "7") + " → " + orig.symbol, "Preparar con ii–V",
            "La cadencia ii–V apuntando a este acorde: lo más típico del jazz para dar movimiento.")
        add(_sym(key, r - 1, "dim7") + " → " + orig.symbol, "Disminuido de aproximación", "Un disminuido medio tono por "
            "debajo sube por semitono a cada nota del acorde.")

    seen: set[str] = set()
    out = []
    for sym, tech, why in cands:
        if sym in seen or sym == orig.symbol:
            continue
        seen.add(sym)
        main = sym.split(" → ")[-1] if " → " in sym else sym
        chain = sym.split(" → ")[0].split() if " → " in sym else []
        try:
            p = parse_symbol(main if not chain else chain[-1])
        except ValueError:
            continue
        entry = {"symbol": sym, "technique": tech, "explanation": why, "common_tones": _common(orig, p),
                 "chain": chain + ([main] if chain else [])}
        a = analyze_chord_in_key(key, p.root.pc, p.base.suffix, p.pcs)
        entry["roman"] = a["roman"]
        if mel_pc is not None:
            entry["melody"] = melody_role(p, mel_pc)
        steps = [Step.from_chord(parse_symbol(c)) for c in (entry["chain"] or [sym])]
        if nxt:
            steps.append(Step.from_chord(nxt))
        voiced = realize(steps)
        entry["voicing"] = voiced
        entry["motion_to_next"] = voiced[-1]["motion"] if nxt else None
        out.append(entry)
    if nxt:
        out.sort(key=lambda e: (e["motion_to_next"], -len(e["common_tones"])))
    original_voicing = realize([Step.from_chord(orig)] + ([Step.from_chord(nxt)] if nxt else []))
    return {"original": orig.to_dict(), "analysis": info, "key": key.name, "substitutes": out,
            "original_voicing": original_voicing,
            "original_melody": melody_role(orig, mel_pc) if mel_pc is not None else None}


def chords_for_melody(note: str, key_text: str, limit: int = 30) -> dict:
    """Todos los acordes que pueden armonizar una nota de la melodía, del más 'en casa' al más lejano."""
    key = Key.parse(key_text)
    mel = parse_symbol(note).root.pc
    rank = {"diatónico": 0, "dominante secundaria": 1, "préstamo modal": 2, "sustituto tritonal": 2,
            "armonía negativa": 2, "disminuido de paso / sensible secundaria": 3, "napolitano / bII": 3,
            "mediante cromática": 4, "cromático": 5}
    out = []
    for root in range(12):
        for suf in MELODY_TYPES:
            sym = _sym(key, root, suf)
            p = parse_symbol(sym)
            role = melody_role(p, mel)
            if not role["ok"]:
                continue
            a = analyze_chord_in_key(key, root, suf, p.pcs)
            out.append({"symbol": sym, "roman": a["roman"], "kind": a["kind"], "function": a["function"],
                        "melody": role, "rank": rank.get(a["kind"], 5) + (0.5 if role["role"] != "nota del acorde" else 0)})
    out.sort(key=lambda e: (e["rank"], e["symbol"]))
    return {"note": pc_name(mel, key.accidental_preference), "key": key.name, "chords": out[:limit]}


STYLES = {
    "jazz": "Jazz: ii–V antes de cada destino, sustitutos tritonales y extensiones (9ª, 13ª).",
    "negativa": "Collier / armonía negativa: dominantes sustituidos por su reflejo negativo y mediantes cromáticas.",
    "gospel": "Góspel / soul: dominantes 'backdoor', IV/V y disminuidos de paso.",
}


def reharmonize(text: str, key_text: str, style: str = "jazz") -> dict:
    """Aplica un estilo de rearmonización a toda una progresión."""
    if style not in STYLES:
        raise ValueError(f"Estilo desconocido: {style}")
    key = Key.parse(key_text)
    chords = parse_progression(text)
    T = key.tonic.pc
    out: list[dict] = []  # {symbol, why, original_index}
    for i, c in enumerate(chords):
        info = analyze_chord_in_key(key, c.root.pc, c.base.suffix, c.pcs)
        fam = c.base.family
        r = c.root.pc
        nxt = chords[i + 1] if i + 1 < len(chords) else None
        resolves = nxt is not None and fam == "dom" and (nxt.root.pc - r) % 12 == 5
        if style == "jazz":
            if fam == "dom" and resolves and i % 2 == 1:
                out.append({"symbol": _sym(key, r + 6, "7", ("9",)), "why": "Sustituto tritonal", "of": i})
            elif fam == "dom":
                prev_is_ii = i > 0 and chords[i - 1].root.pc == (r + 7) % 12 and chords[i - 1].base.family == "min"
                if not prev_is_ii:
                    out.append({"symbol": _sym(key, r + 7, "m7"), "why": "ii añadido (ii–V)", "of": i})
                out.append({"symbol": _sym(key, r, "7", ("9", "13")), "why": "Extensiones 9ª y 13ª", "of": i})
            elif fam == "maj":
                out.append({"symbol": _sym(key, r, "maj7", ("9",)), "why": "maj9: color jazz", "of": i})
            elif fam == "min":
                out.append({"symbol": _sym(key, r, "m7", ("9",)), "why": "m9: color jazz", "of": i})
            else:
                out.append({"symbol": c.symbol, "why": "", "of": i})
        elif style == "negativa":
            if fam == "dom" and info["function"] == "D":
                out.append({"symbol": _sym(key, T + 5, "m6"), "why": f"Dominante negativa de {c.symbol} (iv m6)", "of": i})
            elif fam == "maj" and info["function"] == "T" and i not in (0, len(chords) - 1):
                out.append({"symbol": _sym(key, r + 8, "maj7"), "why": "Mediante cromática (bVI)", "of": i})
            elif fam == "min" and info["kind"] == "diatónico":
                neg = {negative_pc(p, T) for p in c.pcs}
                named = None
                for root in sorted(neg):
                    for suf in ("maj7", "6", "", "m7", "7"):
                        if {(root + TONES[t][0]) % 12 for t in BASE_BY_SUFFIX[suf].tones} == neg:
                            named = _sym(key, root, suf)
                            break
                    if named:
                        break
                out.append({"symbol": named or c.symbol, "why": "Reflejo negativo" if named else "", "of": i})
            else:
                out.append({"symbol": c.symbol, "why": "", "of": i})
        else:  # gospel
            if fam == "dom" and resolves and (nxt.root.pc - T) % 12 == 0:
                out.append({"symbol": _sym(key, T - 2, "7"), "why": "Dominante backdoor (bVII7)", "of": i})
            elif fam == "dom":
                out.append({"symbol": _sym(key, r - 2, "maj7") + "/" + _root_name(key, r), "why": "IV/V sobre el bajo del V", "of": i})
            else:
                out.append({"symbol": c.symbol, "why": "", "of": i})
                if nxt is not None and fam in ("maj", "min") and (nxt.root.pc - r) % 12 == 2:
                    out.append({"symbol": _sym(key, r + 1, "dim7"), "why": "Disminuido de paso cromático", "of": i})
    original = realize([Step.from_chord(c) for c in chords])
    new_steps = [Step.from_chord(parse_symbol(o["symbol"])) for o in out]
    voiced = realize(new_steps)
    for o, v in zip(out, voiced):
        o["voicing"] = v
    return {"key": key.name, "style": style, "style_description": STYLES[style],
            "original": [{"symbol": c.symbol, "voicing": v} for c, v in zip(chords, original)],
            "reharmonized": out,
            "motion_original": sum(v["motion"] for v in original),
            "motion_reharmonized": sum(v["motion"] for v in voiced)}

