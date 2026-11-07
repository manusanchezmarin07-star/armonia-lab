"""Puentes entre tonalidades y explicación de transiciones entre dos acordes.

La idea central para "ver fácil" un cambio brusco: un cambio suena suave cuando
las voces se mueven poco (notas comunes que se mantienen y el resto por semitono
o tono). Por eso cada ruta se acompaña de una conducción de voces calculada que
minimiza el movimiento total, y se mide su "suavidad" en semitonos.
"""
from __future__ import annotations

from .chords import identify, parse_symbol
from .keys import Key, negative_pc
from .pitch import interval_name, letter_up, pc_name, spell_pc
from .voicing import Step, realize, voicing_pcs

__all__ = ["Step", "realize", "voicing_pcs", "modulation_routes", "explain_transition", "pivot_chords",
           "diminished_family", "fifths_distance"]



# ---------------------------------------------------------------------------
# Rutas de modulación
# ---------------------------------------------------------------------------

def tonic_symbol(k: Key) -> str:
    return k.tonic.name + ("m" if k.mode == "minor" else "")


def _dominant(k: Key) -> str:
    return k.scale[4].name + "7"


def _ii(k: Key) -> str:
    return k.scale[1].name + ("m7" if k.mode == "major" else "m7b5")


def _vii_dim7(k: Key) -> str:
    return spell_pc((k.tonic.pc + 11) % 12, letter_up(k.tonic.letter, 6)).name + "dim7"


def _subv(k: Key) -> str:
    return spell_pc((k.tonic.pc + 1) % 12, letter_up(k.tonic.letter, 1)).name + "7"


def _negative_dominant(k: Key) -> str:
    # El reflejo negativo de V7 es iv m6 (en Do: G7 -> Fm6); aquí se usa iv m6.
    return k.scale[3].name + "m6"


def _v_of_v(k: Key) -> str:
    return spell_pc((k.tonic.pc + 2) % 12, letter_up(k.tonic.letter, 1)).name + "7"


def pivot_chords(a: Key, b: Key) -> list[dict]:
    """Acordes diatónicos en ambas tonalidades (acordes pivote) con su grado en cada una."""
    out = []
    for sev in (False, True):
        cb = {frozenset(c["pcs"]): c for c in b.diatonic_chords(sev)}
        for c in a.diatonic_chords(sev):
            other = cb.get(frozenset(c["pcs"]))
            if other:
                out.append({"symbol": c["symbol"], "roman_from": c["roman"], "roman_to": other["roman"],
                            "function_to": other["function_es"], "pcs": c["pcs"]})
    return out


def modulation_routes(a: Key, b: Key) -> dict:
    """Rutas típicas para ir de la tonalidad `a` a la `b`, ordenadas de más suave a más brusca."""
    ta, tb = tonic_symbol(a), tonic_symbol(b)
    routes: list[tuple[str, str, list[Step]]] = []

    routes.append(("Dominante directa", "Se toca el V7 de la nueva tonalidad: su tritono exige "
                   f"resolver a {tb} y el oído acepta el cambio.",
                   [Step.of(ta, "I origen"), Step.of(_dominant(b), "V7 destino"), Step.of(tb, "I destino")]))
    routes.append(("ii – V – I", "La cadencia más usada del jazz: el ii prepara al V, que resuelve a la nueva tónica.",
                   [Step.of(ta, "I origen"), Step.of(_ii(b), "ii destino"), Step.of(_dominant(b), "V7"),
                    Step.of(tb, "I destino")]))

    pivots = pivot_chords(a, b)
    if pivots:
        # Mejor pivote: el que en el destino tiene función de subdominante (prepara al V).
        best = sorted(pivots, key=lambda p: ("Subdominante" not in p["function_to"], len(p["pcs"])))[0]
        routes.append(("Acorde pivote", f"{best['symbol']} pertenece a las dos tonalidades: es "
                       f"{best['roman_from']} en {a.name} y {best['roman_to']} en {b.name}. El oído lo "
                       "escucha en la tonalidad vieja y se da cuenta tarde de que ya está en la nueva.",
                       [Step.of(ta, "I origen"), Step.of(best["symbol"], f"pivote {best['roman_from']} = {best['roman_to']}"),
                        Step.of(_dominant(b), "V7 destino"), Step.of(tb, "I destino")]))

    dim = _vii_dim7(b)
    dim_keys = diminished_family(parse_symbol(dim).pcs)
    routes.append(("Bisagra disminuida", f"{dim} es la sensible de {tb}. Como el acorde disminuido es "
                   "simétrico (todo 3ªs menores) suena igual que otros 3 disminuidos y puede resolver a "
                   f"{', '.join(d['resolves_to'] for d in dim_keys)}: es la puerta a 4 tonalidades.",
                   [Step.of(ta, "I origen"), Step.of(dim, "vii°7 destino"), Step.of(tb, "I destino")]))

    routes.append(("Sustituto tritonal", f"En lugar del V7 se usa {_subv(b)}, que comparte su tritono y "
                   "baja por semitono hasta la tónica: el bajo hace un cromatismo muy suave.",
                   [Step.of(ta, "I origen"), Step.of(_ii(b), "ii destino"), Step.of(_subv(b), "subV7"),
                    Step.of(tb, "I destino")]))

    routes.append(("Cadena de dominantes", "V7/V → V7 → I: cada dominante resuelve en el siguiente, "
                   "como fichas de dominó. Crea una inercia que arrastra al oído.",
                   [Step.of(ta, "I origen"), Step.of(_v_of_v(b), "V7/V"), Step.of(_dominant(b), "V7"),
                    Step.of(tb, "I destino")]))

    if b.mode == "major":
        routes.append(("Dominante negativa (armonía negativa)", f"{_negative_dominant(b)} es el reflejo de "
                       f"{_dominant(b)} en armonía negativa: misma función, color oscuro y "
                       "resolución plagal (de arriba abajo). Recurso muy de Jacob Collier.",
                       [Step.of(ta, "I origen"), Step.of(_negative_dominant(b), "iv m6 = V7 negativo"),
                        Step.of(tb, "I destino")]))

    common = sorted(set(parse_symbol(ta).pcs) & set(parse_symbol(tb).pcs))
    if common and ta != tb:
        names = ", ".join(pc_name(p) for p in common)
        routes.append(("Nota común", f"Los dos acordes de tónica comparten {names}. Si esa nota se "
                       "mantiene (por ejemplo en la melodía) el salto se disimula aunque no haya cadencia.",
                       [Step.of(ta, "I origen"), Step.of(tb, "I destino")]))

    realized = []
    for name, why, steps in routes:
        voiced = realize(steps)
        motion = sum(s["motion"] for s in voiced)
        realized.append({"name": name, "explanation": why, "steps": voiced,
                         "total_motion": motion,
                         "avg_motion": round(motion / max(1, len(voiced) - 1), 1)})
    realized.sort(key=lambda r: r["avg_motion"])
    return {"from": a.name, "to": b.name, "pivots": pivots, "routes": realized,
            "distance_fifths": fifths_distance(a, b)}


def fifths_distance(a: Key, b: Key) -> int:
    """Distancia en el círculo de quintas entre las armaduras (relativas incluidas)."""
    def sig(k: Key) -> int:
        major_pc = k.tonic.pc if k.mode == "major" else (k.tonic.pc + 3) % 12
        return (major_pc * 7) % 12  # número de quintas desde Do
    d = (sig(b) - sig(a)) % 12
    return d if d <= 6 else d - 12


def diminished_family(pcs: list[int]) -> list[dict]:
    """Para un acorde dim7: los 4 dominantes que salen bajando una nota medio tono.

    Es la propiedad que convierte al disminuido en un "comodín" entre tonalidades.
    """
    out = []
    s = set(pcs)
    for p in sorted(s):
        new = (s - {p}) | {(p - 1) % 12}
        for r in identify(sorted(new), bass=(p - 1) % 12, is_midi=False, limit=8):
            if r.base.suffix == "7" and not r.tensions:
                root = pc_name(r.root_pc)
                out.append({"lowered": pc_name(p), "dominant": root + "7",
                            "resolves_to": pc_name(r.root_pc + 5)})
                break
    return out


def explain_transition(x_sym: str, y_sym: str) -> dict:
    """Por qué el acorde X lleva bien (o mal) al acorde Y."""
    x, y = parse_symbol(x_sym), parse_symbol(y_sym)
    xs, ys = set(x.pcs), set(y.pcs)
    root_iv = (y.root.pc - x.root.pc) % 12
    relations: list[str] = []
    fam_x = x.base.family
    if root_iv == 5 and fam_x in ("dom", "maj"):
        relations.append(f"{x.symbol} es el dominante (V) de {y.symbol}: movimiento de 5ª descendente, "
                         "la resolución más fuerte de la música tonal.")
    if root_iv == 11 and fam_x == "dom":
        relations.append(f"{x.symbol} es el sustituto tritonal del dominante de {y.symbol}: el bajo "
                         "baja medio tono y el tritono se conserva.")
    if root_iv == 1 and fam_x in ("dim", "hdim"):
        relations.append(f"{x.symbol} actúa como sensible de {y.symbol}: su fundamental sube medio tono.")
    if x.base.suffix == "dim7":
        fam = diminished_family(x.pcs)
        relations.append("Acorde disminuido simétrico: bajando cualquiera de sus notas medio tono "
                         f"obtienes {', '.join(f['dominant'] for f in fam)}, que resuelven a "
                         f"{', '.join(f['resolves_to'] for f in fam)}.")
    neg_v7 = {negative_pc((y.root.pc + i) % 12, y.root.pc) for i in (7, 11, 2, 5)}
    if y.base.family == "maj" and xs <= neg_v7 | {negative_pc((y.root.pc + 9) % 12, y.root.pc)} and len(xs) >= 3:
        relations.append(f"{x.symbol} es (parte de) la dominante negativa de {y.symbol}: el reflejo de su V7 "
                         "en armonía negativa. Resuelve con la misma fuerza pero desde la oscuridad.")
    if root_iv in (3, 4, 8, 9) and x.base.family == y.base.family and x.base.family in ("maj", "min"):
        relations.append("Relación de mediante cromática: fundamentales a distancia de 3ª, mismo tipo "
                         "de acorde. Cambio de color brusco pero con nota común.")
    if root_iv == 0 and x.base.family != y.base.family:
        relations.append("Misma fundamental, distinto modo: intercambio modal (mayor ↔ menor).")

    shared_keys = []
    for tonic in range(12):
        for mode in ("major", "minor"):
            k = Key(spell_pc(tonic, _best_letter(tonic)), mode)
            if xs <= k.pcs and ys <= k.pcs:
                shared_keys.append(k.name)
    if shared_keys:
        relations.append(f"Ambos acordes conviven en: {', '.join(shared_keys[:6])}.")

    voiced = realize([Step(x.symbol, voicing_pcs(x), x.bass_pc), Step(y.symbol, voicing_pcs(y), y.bass_pc)])
    return {
        "from": x.to_dict(), "to": y.to_dict(),
        "common_tones": [pc_name(p) for p in sorted(xs & ys)],
        "root_motion": interval_name(root_iv), "relations": relations,
        "voicing": voiced, "motion": voiced[-1]["motion"],
        "smoothness": _smooth_label(voiced[-1]["motion"], len(xs & ys)),
    }


def _best_letter(pc: int) -> str:
    return pc_name(pc)[0]


def _smooth_label(motion: int, common: int) -> str:
    if motion <= 3 or (common >= 2 and motion <= 5):
        return "muy suave"
    if motion <= 6:
        return "suave"
    if motion <= 10:
        return "contrastado"
    return "brusco"


