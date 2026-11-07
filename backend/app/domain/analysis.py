"""Análisis de progresiones: tonalidad de cada acorde, grados, modulaciones y
transformación a armonía negativa."""
from __future__ import annotations

from .chords import ParsedChord, identify, parse_progression
from .keys import Key, analyze_chord_in_key, negative_midi, negative_pc
from .pitch import FLAT_NAMES, SHARP_NAMES, letter_up, parse_note, pc_name, spell_pc
from .voicing import Step, realize

# Costes del algoritmo de Viterbi. Cambiar de tonalidad cuesta más que explicar
# un acorde cromático dentro de la misma: así no se "inventan" modulaciones por
# cada dominante secundaria, que es el error típico de los analizadores ingenuos.
COST = {"diatónico": 0.0, "dominante secundaria": 0.6, "sustituto tritonal": 0.8,
        "disminuido de paso / sensible secundaria": 0.7, "préstamo modal": 0.9,
        "armonía negativa": 1.0, "napolitano / bII": 1.0, "mediante cromática": 1.6, "cromático": 2.5}
KEY_CHANGE = 2.2


def _all_keys() -> list[Key]:
    keys = []
    for pc in range(12):
        # Deletreo de la tónica: el que da menos alteraciones en la armadura.
        for mode in ("major", "minor"):
            cands = {SHARP_NAMES[pc], FLAT_NAMES[pc]}
            best = min((Key(parse_note(n), mode) for n in cands),
                       key=lambda k: sum(1 for x in k.scale if x.alter != 0))
            keys.append(best)
    return keys


ALL_KEYS = _all_keys()


def _chord_cost(key: Key, ch: ParsedChord, edge: bool = False) -> tuple[float, dict]:
    info = analyze_chord_in_key(key, ch.root.pc, ch.base.suffix, ch.pcs)
    cost = COST.get(info["kind"], 2.5)
    # Pequeño sesgo hacia la tonalidad cuyo I o V aparece: ayuda a desempatar
    # entre relativas (C mayor vs A menor) que comparten todos los acordes.
    if info["kind"] == "diatónico":
        rel = (ch.root.pc - key.tonic.pc) % 12
        if rel == 0:
            # Empezar o acabar en la tónica es la pista más fuerte de la tonalidad.
            cost -= 1.0 if edge else 0.3
        elif rel == 7 and ch.base.family == "dom":
            cost -= 0.2
    return cost, info


def analyze_progression(text: str, key_text: str | None = None) -> dict:
    """Analiza una progresión. Si no se da tonalidad, la deduce (con posibles modulaciones)."""
    chords = parse_progression(text)
    if not chords:
        raise ValueError("La progresión está vacía")
    keys = [Key.parse(key_text)] if key_text else ALL_KEYS

    # Viterbi: estado = tonalidad; coste = explicación de cada acorde + cambios.
    n, m = len(chords), len(keys)
    costs = [[0.0] * m for _ in range(n)]
    infos = [[{}] * m for _ in range(n)]
    back = [[0] * m for _ in range(n)]
    for j, k in enumerate(keys):
        costs[0][j], infos[0][j] = _chord_cost(k, chords[0], edge=True)
    for i in range(1, n):
        for j, k in enumerate(keys):
            c, info = _chord_cost(k, chords[i], edge=(i == n - 1))
            best_prev = min(range(m), key=lambda p: costs[i - 1][p] + (0 if p == j else KEY_CHANGE))
            costs[i][j] = costs[i - 1][best_prev] + (0 if best_prev == j else KEY_CHANGE) + c
            infos[i][j] = info
            back[i][j] = best_prev
    # Al final se premia acabar en la tónica (las canciones suelen cadenciar).
    last = min(range(m), key=lambda j: costs[n - 1][j])
    path = [last]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    path.reverse()

    steps = [Step.from_chord(c) for c in chords]
    voiced = realize(steps)
    out_chords = []
    modulations = []
    for i, (c, j) in enumerate(zip(chords, path)):
        k = keys[j]
        entry = {**c.to_dict(), "key": k.name, "analysis": infos[i][j], "voicing": voiced[i]}
        if i > 0 and path[i - 1] != j:
            prev_key = keys[path[i - 1]]
            # Acorde pivote: el anterior al cambio si también es diatónico en la nueva tonalidad.
            pivot = None
            prev_c = chords[i - 1]
            if analyze_chord_in_key(k, prev_c.root.pc, prev_c.base.suffix, prev_c.pcs)["kind"] == "diatónico":
                pivot = prev_c.symbol
            modulations.append({"at": i, "from": prev_key.name, "to": k.name, "pivot": pivot})
        out_chords.append(entry)
    return {"key": keys[path[0]].name, "chords": out_chords, "modulations": modulations}


def negative_progression(text: str, key_text: str) -> dict:
    """Refleja cada acorde de la progresión en armonía negativa respecto a la tónica dada."""
    key = Key.parse(key_text)
    tonic = key.tonic.pc
    chords = parse_progression(text)
    steps = [Step.from_chord(c) for c in chords]
    original = realize(steps)
    pairs = []
    for c, v in zip(chords, original):
        # Se reflejan las notas MIDI reales (no solo las clases) para que el voicing
        # negativo conserve la forma "en espejo" del original.
        mirrored_upper = sorted(negative_midi(mi, tonic) for mi in v["upper"])
        mirrored_bass = negative_midi(v["bass"], tonic, around=48)
        neg_pcs = sorted({negative_pc(p, tonic) for p in c.pcs})
        # El bajo reflejado suele caer en una nota que no es la fundamental. Para
        # nombrarlo se prueban todas las lecturas y se prefiere la de fundamental
        # sin inversión (es como lo cifra la mayoría de músicos).
        mirrored = identify(neg_pcs, bass=negative_pc(c.bass_pc, tonic), is_midi=False, limit=6)
        root_pos = []
        for b in neg_pcs:
            root_pos += [r for r in identify(neg_pcs, bass=b, is_midi=False, limit=8) if r.bass_pc == r.root_pc]
        root_pos.sort(key=lambda r: r.score)
        names = list(dict.fromkeys(r.symbol for r in root_pos))
        # Algunos reflejos (p. ej. de C7b9) no tienen nombre estándar: se muestran
        # como conjunto de notas entre llaves en lugar de inventar un cifrado.
        name = names[0] if names else (mirrored[0].symbol if mirrored else
                                       "{" + " ".join(pc_name(p, key.accidental_preference) for p in neg_pcs) + "}")
        alt = names[1:3]
        root_name = mirrored[0].symbol if mirrored else None
        pairs.append({
            "original": c.symbol, "negative": name, "negative_mirrored_bass": root_name,
            "alternatives": alt,
            "original_voicing": {"bass": v["bass"], "upper": v["upper"]},
            "negative_voicing": {"bass": mirrored_bass, "upper": mirrored_upper},
            "original_analysis": analyze_chord_in_key(key, c.root.pc, c.base.suffix, c.pcs),
        })
    axis = f"entre {_flat3(key)} y {_maj3(key)}"
    return {"key": key.name, "axis": axis, "pairs": pairs}


def _flat3(key: Key) -> str:
    return spell_pc((key.tonic.pc + 3) % 12, letter_up(key.tonic.letter, 2)).name


def _maj3(key: Key) -> str:
    return spell_pc((key.tonic.pc + 4) % 12, letter_up(key.tonic.letter, 2)).name
