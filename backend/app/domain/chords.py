"""Acordes: identificación a partir de notas, parseo de cifrado americano y deletreo.

Diseño: en lugar de una tabla gigante con todos los acordes posibles (C7b9#11b13...)
se definen *acordes base* (tríadas, cuatriadas, sus) y un conjunto de *tensiones*
permitidas para cada familia. Así se pueden reconocer los voicings densos tipo
Jacob Collier o Bill Evans sin listar miles de combinaciones, y el nombre se genera
siguiendo las convenciones habituales del cifrado de jazz.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .pitch import (
    SpelledNote,
    letter_up,
    parse_note,
    pc_name,
    spell_pc,
)

# etiqueta -> (semitonos sobre la fundamental, grados de letra por encima).
# Los grados de letra sirven para deletrear: la 3ª siempre está 2 letras arriba.
TONES: dict[str, tuple[int, int]] = {
    "1": (0, 0), "b9": (1, 1), "9": (2, 1), "#9": (3, 1), "2": (2, 1),
    "b3": (3, 2), "3": (4, 2), "4": (5, 3), "11": (5, 3), "#11": (6, 3),
    "b5": (6, 4), "5": (7, 4), "#5": (8, 4), "b13": (8, 5), "6": (9, 5),
    "13": (9, 5), "bb7": (9, 6), "b7": (10, 6), "7": (11, 6),
}

TONE_NAMES_ES = {
    "1": "fundamental", "b3": "3ª menor", "3": "3ª mayor", "4": "4ª", "2": "2ª",
    "b5": "5ª disminuida", "5": "5ª justa", "#5": "5ª aumentada", "6": "6ª",
    "bb7": "7ª disminuida", "b7": "7ª menor", "7": "7ª mayor", "b9": "9ª menor",
    "9": "9ª", "#9": "9ª aumentada", "11": "11ª", "#11": "11ª aumentada",
    "b13": "13ª menor", "13": "13ª",
}


@dataclass(frozen=True)
class BaseChord:
    suffix: str
    name_es: str
    tones: tuple[str, ...]
    family: str  # 'maj', 'min', 'dom', 'dim', 'hdim', 'aug', 'sus', 'power'
    complexity: float
    allowed_tensions: tuple[str, ...] = ()


# Tensiones disponibles por familia. Siguen la práctica del jazz: sobre un
# dominante caben todas las alteraciones; sobre maj7 la 11ª natural choca con la
# 3ª (nota a evitar) así que solo se acepta #11.
_DOM_T = ("b9", "9", "#9", "11", "#11", "b13", "13")
_MAJ_T = ("9", "#11", "13")
_MIN_T = ("9", "11", "13", "b13")

BASE_CHORDS: tuple[BaseChord, ...] = (
    BaseChord("", "tríada mayor", ("1", "3", "5"), "maj", 0.0, ("9", "#11")),
    BaseChord("m", "tríada menor", ("1", "b3", "5"), "min", 0.0, ("9", "11")),
    BaseChord("dim", "tríada disminuida", ("1", "b3", "b5"), "dim", 0.6),
    BaseChord("aug", "tríada aumentada", ("1", "3", "#5"), "aug", 0.6),
    BaseChord("sus4", "acorde suspendido de 4ª", ("1", "4", "5"), "sus", 0.8, ("9",)),
    BaseChord("sus2", "acorde suspendido de 2ª", ("1", "2", "5"), "sus", 0.9),
    BaseChord("6", "sexta mayor", ("1", "3", "5", "6"), "maj", 0.9, ("9", "#11")),
    BaseChord("m6", "sexta menor", ("1", "b3", "5", "6"), "min", 0.9, ("9", "11")),
    BaseChord("7", "séptima de dominante", ("1", "3", "5", "b7"), "dom", 0.5, _DOM_T),
    BaseChord("maj7", "séptima mayor", ("1", "3", "5", "7"), "maj", 0.5, _MAJ_T),
    BaseChord("m7", "menor séptima", ("1", "b3", "5", "b7"), "min", 0.5, _MIN_T),
    BaseChord("m(maj7)", "menor con 7ª mayor", ("1", "b3", "5", "7"), "min", 1.0, ("9", "11", "13")),
    BaseChord("m7b5", "semidisminuido", ("1", "b3", "b5", "b7"), "hdim", 0.6, ("9", "11", "b13")),
    BaseChord("dim7", "disminuido (7ª disminuida)", ("1", "b3", "b5", "bb7"), "dim", 0.6, ("9", "11", "b13", "7")),
    BaseChord("7sus4", "dominante suspendido", ("1", "4", "5", "b7"), "sus", 0.8, ("9", "b9", "13")),
    BaseChord("7#5", "dominante aumentado", ("1", "3", "#5", "b7"), "dom", 0.9, ("b9", "9", "#9", "#11")),
    BaseChord("7b5", "dominante con 5ª disminuida", ("1", "3", "b5", "b7"), "dom", 1.0, ("b9", "9", "#9", "13")),
    BaseChord("maj7#5", "séptima mayor aumentada", ("1", "3", "#5", "7"), "aug", 1.0, ("9", "#11")),
    BaseChord("5", "quinta (power chord)", ("1", "5"), "power", 1.5),
)
BASE_BY_SUFFIX = {b.suffix: b for b in BASE_CHORDS}

# Las tensiones que pueden "ocupar el hueco" de la 5ª justa sin cambiar la
# identidad del acorde (la 5ª es la nota que más se omite en los voicings).
OPTIONAL = {"5"}


@dataclass
class ChordReading:
    """Una interpretación posible de un conjunto de notas."""

    root_pc: int
    base: BaseChord
    tensions: tuple[str, ...]
    bass_pc: int
    omitted: tuple[str, ...] = ()
    score: float = 0.0
    root_name: str = ""
    spelled: list[str] = field(default_factory=list)

    @property
    def symbol(self) -> str:
        sym = self.root_name + chord_suffix(self.base, self.tensions)
        if self.bass_pc != self.root_pc:
            sym += "/" + _bass_name(self)
        return sym

    @property
    def pcs(self) -> list[int]:
        labels = [t for t in self.base.tones if t not in self.omitted] + list(self.tensions)
        return [(self.root_pc + TONES[t][0]) % 12 for t in labels]

    def to_dict(self) -> dict:
        labels = [t for t in self.base.tones if t not in self.omitted] + list(self.tensions)
        return {
            "symbol": self.symbol,
            "root": self.root_name,
            "root_pc": self.root_pc,
            "quality": self.base.name_es,
            "family": self.base.family,
            "base_suffix": self.base.suffix,
            "tensions": list(self.tensions),
            "omitted": list(self.omitted),
            "bass_pc": self.bass_pc,
            "inversion": inversion_name(self),
            "tones": [
                {"label": t, "name": TONE_NAMES_ES[t], "note": n,
                 "pc": (self.root_pc + TONES[t][0]) % 12}
                for t, n in zip(labels, self.spelled)
            ],
            "score": round(self.score, 2),
        }


def _bass_name(r: ChordReading) -> str:
    # Si la nota del bajo es una nota del acorde se deletrea igual que dentro
    # del acorde (C/E y no C/Fb); si no, se usa el nombre por defecto.
    for pc, name in zip(r.pcs, r.spelled):
        if pc == r.bass_pc:
            return name
    return pc_name(r.bass_pc)


def chord_suffix(base: BaseChord, tensions: tuple[str, ...] | list[str]) -> str:
    """Genera el sufijo de cifrado (C + 'maj9(#11)') según convenciones de jazz.

    Las extensiones naturales que se "apilan" (9, 11, 13) cambian el número del
    acorde (C9, Cm11, C13); las alteradas van entre paréntesis (C7(b9,#11)).
    """
    t = set(tensions)
    paren: list[str] = []
    s = base.suffix
    if base.suffix == "7":
        if "13" in t and "9" in t:
            s, rest = "13", t - {"13", "9"}
        elif "9" in t:
            s, rest = "9", t - {"9"}
        else:
            rest = t
        paren = sorted(rest, key=_tension_order)
    elif base.suffix == "maj7":
        if "13" in t and "9" in t:
            s, rest = "maj13", t - {"13", "9"}
        elif "9" in t:
            s, rest = "maj9", t - {"9"}
        else:
            rest = t
        paren = sorted(rest, key=_tension_order)
    elif base.suffix == "m7":
        if {"9", "11", "13"} <= t or {"9", "13"} <= t:
            s, rest = "m13", t - {"9", "11", "13"}
        elif {"9", "11"} <= t:
            s, rest = "m11", t - {"9", "11"}
        elif "9" in t:
            s, rest = "m9", t - {"9"}
        else:
            rest = t
        paren = sorted(rest, key=_tension_order)
    elif base.suffix in ("6", "m6") and "9" in t:
        s = base.suffix + "/9"
        paren = sorted(t - {"9"}, key=_tension_order)
    elif base.suffix in ("", "m") and t:
        if t == {"9"}:
            return base.suffix + "add9"
        paren = ["add" + x for x in sorted(t, key=_tension_order)]
    elif base.suffix == "7sus4" and "9" in t:
        s = "9sus4"
        paren = sorted(t - {"9"}, key=_tension_order)
    else:
        paren = sorted(t, key=_tension_order)
    # La 7ª mayor como tensión (sobre dim7) se escribe "maj7" para no confundirla con la 7ª menor.
    paren = ["maj7" if x == "7" else x for x in paren]
    return s + (f"({','.join(paren)})" if paren else "")


def _tension_order(t: str) -> int:
    return [x for x in ("b9", "9", "#9", "11", "#11", "b13", "13", "7")].index(t)


def spell_chord(root: SpelledNote, labels: list[str]) -> list[str]:
    return [spell_pc((root.pc + TONES[l][0]) % 12, letter_up(root.letter, TONES[l][1])).name
            for l in labels]


def choose_root_spelling(root_pc: int, prefer: str = "default") -> SpelledNote:
    return parse_note(pc_name(root_pc, prefer))


def identify(pcs_or_midi: list[int], bass: int | None = None, *, is_midi: bool = True,
             prefer: str = "default", limit: int = 5) -> list[ChordReading]:
    """Devuelve las lecturas posibles de un conjunto de notas, la más probable primero.

    `bass` es la nota más grave; si se pasan MIDI se deduce sola. La puntuación
    premia que el bajo sea la fundamental y las lecturas más simples, que es como
    razona un músico: {C,E,G,A} con Do en el bajo es C6, con La en el bajo es Am7.
    """
    if not pcs_or_midi:
        return []
    if is_midi:
        bass_pc = min(pcs_or_midi) % 12 if bass is None else bass % 12
    else:
        bass_pc = pcs_or_midi[0] % 12 if bass is None else bass % 12
    pcs = sorted({p % 12 for p in pcs_or_midi})
    if len(pcs) < 2:
        return []

    readings: list[ChordReading] = []
    for root in pcs:
        rel = {(p - root) % 12 for p in pcs}
        for base in BASE_CHORDS:
            if base.family == "power" and len(pcs) != 2:
                continue
            core = {TONES[t][0]: t for t in base.tones}
            required = {s for s, t in core.items() if t not in OPTIONAL}
            if not required <= rel:
                continue
            omitted = tuple(t for s, t in core.items() if s not in rel)
            extras = rel - set(core)
            tensions = _map_tensions(extras, base)
            if tensions is None:
                continue
            score = base.complexity + 0.7 * len(tensions) + 0.4 * len(omitted)
            if bass_pc != root:
                score += 1.0 if bass_pc in {(root + s) % 12 for s in core} else 1.8
            # Dos notas solas casi nunca bastan para afirmar un acorde.
            if len(pcs) == 2:
                score += 2.0
            readings.append(ChordReading(root, base, tensions, bass_pc, omitted, score))

    readings.sort(key=lambda r: (r.score, r.root_pc != bass_pc))
    out: list[ChordReading] = []
    seen: set[str] = set()
    for r in readings:
        root = choose_root_spelling(r.root_pc, prefer)
        r.root_name = root.name
        labels = [t for t in r.base.tones if t not in r.omitted] + list(r.tensions)
        r.spelled = spell_chord(root, labels)
        if r.symbol not in seen:
            seen.add(r.symbol)
            out.append(r)
        if len(out) >= limit:
            break
    return out


def _map_tensions(extras: set[int], base: BaseChord) -> tuple[str, ...] | None:
    """Asigna a cada semitono sobrante una etiqueta de tensión válida o devuelve None."""
    labels: list[str] = []
    for s in sorted(extras):
        options = [t for t in base.allowed_tensions if TONES[t][0] == s]
        if not options:
            return None
        labels.append(options[0])
    return tuple(sorted(labels, key=_tension_order))


def inversion_name(r: ChordReading) -> str:
    if r.bass_pc == r.root_pc:
        return "estado fundamental"
    rel = (r.bass_pc - r.root_pc) % 12
    for label in r.base.tones:
        if TONES[label][0] == rel:
            return {"3": "1ª inversión", "b3": "1ª inversión", "5": "2ª inversión",
                    "b5": "2ª inversión", "#5": "2ª inversión", "b7": "3ª inversión",
                    "7": "3ª inversión", "bb7": "3ª inversión", "6": "3ª inversión",
                    "4": "2ª inversión (4ª en el bajo)", "2": "2ª en el bajo"}.get(label, "invertido")
    return "nota ajena en el bajo"


# ---------------------------------------------------------------------------
# Parseo de cifrado americano
# ---------------------------------------------------------------------------

_SUFFIX_ALIASES = {
    "": ("", ()), "M": ("", ()), "maj": ("", ()), "m": ("m", ()), "min": ("m", ()), "-": ("m", ()),
    "dim": ("dim", ()), "°": ("dim", ()), "o": ("dim", ()), "aug": ("aug", ()), "+": ("aug", ()),
    "sus": ("sus4", ()), "sus4": ("sus4", ()), "sus2": ("sus2", ()), "5": ("5", ()),
    "6": ("6", ()), "m6": ("m6", ()), "6/9": ("6", ("9",)), "69": ("6", ("9",)), "m6/9": ("m6", ("9",)),
    "add9": ("", ("9",)), "add2": ("", ("9",)), "madd9": ("m", ("9",)),
    "7": ("7", ()), "9": ("7", ("9",)), "13": ("7", ("9", "13")), "11": ("7sus4", ("9",)),
    "maj7": ("maj7", ()), "M7": ("maj7", ()), "Maj7": ("maj7", ()), "∆": ("maj7", ()), "Δ": ("maj7", ()),
    "∆7": ("maj7", ()), "Δ7": ("maj7", ()), "maj9": ("maj7", ("9",)), "maj13": ("maj7", ("9", "13")),
    "∆9": ("maj7", ("9",)), "Δ9": ("maj7", ("9",)),
    "m7": ("m7", ()), "-7": ("m7", ()), "min7": ("m7", ()), "m9": ("m7", ("9",)), "-9": ("m7", ("9",)),
    "m11": ("m7", ("9", "11")), "-11": ("m7", ("9", "11")), "m13": ("m7", ("9", "13")),
    "m(maj7)": ("m(maj7)", ()), "mMaj7": ("m(maj7)", ()), "mM7": ("m(maj7)", ()), "m∆7": ("m(maj7)", ()),
    "mΔ7": ("m(maj7)", ()), "-∆7": ("m(maj7)", ()),
    "m7b5": ("m7b5", ()), "ø": ("m7b5", ()), "ø7": ("m7b5", ()), "-7b5": ("m7b5", ()),
    "dim7": ("dim7", ()), "°7": ("dim7", ()), "o7": ("dim7", ()),
    "7sus4": ("7sus4", ()), "7sus": ("7sus4", ()), "9sus4": ("7sus4", ("9",)), "9sus": ("7sus4", ("9",)),
    "7#5": ("7#5", ()), "7+5": ("7#5", ()), "aug7": ("7#5", ()), "+7": ("7#5", ()),
    "7b5": ("7b5", ()), "maj7#5": ("maj7#5", ()), "∆#5": ("maj7#5", ()),
    "7b9": ("7", ("b9",)), "7#9": ("7", ("#9",)), "7#11": ("7", ("#11",)), "7b13": ("7", ("b13",)),
    "9#11": ("7", ("9", "#11")), "maj7#11": ("maj7", ("#11",)), "maj9#11": ("maj7", ("9", "#11")),
    "7alt": ("7", ("b9", "#9", "#11", "b13")), "alt": ("7", ("b9", "#9", "#11", "b13")),
}

_SYMBOL_RE = re.compile(r"^\s*([A-Ga-g](?:##|bb|#|b|♯|♭)?)(.*?)(?:/([A-Ga-g](?:#|b|♯|♭)?))?\s*$")


@dataclass
class ParsedChord:
    root: SpelledNote
    base: BaseChord
    tensions: tuple[str, ...]
    bass: SpelledNote | None
    text: str

    @property
    def labels(self) -> list[str]:
        omit = {"5"} if "alt" in self.text else set()
        return [t for t in self.base.tones if t not in omit] + list(self.tensions)

    @property
    def pcs(self) -> list[int]:
        return [(self.root.pc + TONES[l][0]) % 12 for l in self.labels]

    @property
    def bass_pc(self) -> int:
        return self.bass.pc if self.bass else self.root.pc

    @property
    def symbol(self) -> str:
        s = self.root.name + chord_suffix(self.base, self.tensions)
        return s + (f"/{self.bass.name}" if self.bass else "")

    @property
    def spelled(self) -> list[str]:
        return spell_chord(self.root, self.labels)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol, "input": self.text, "root": self.root.name,
            "root_pc": self.root.pc, "quality": self.base.name_es, "family": self.base.family,
            "base_suffix": self.base.suffix, "tensions": list(self.tensions),
            "pcs": self.pcs, "notes": self.spelled, "bass_pc": self.bass_pc,
            "bass": self.bass.name if self.bass else self.root.name,
            "tones": [{"label": l, "name": TONE_NAMES_ES[l], "note": n,
                       "pc": (self.root.pc + TONES[l][0]) % 12}
                      for l, n in zip(self.labels, self.spelled)],
        }


def parse_symbol(text: str) -> ParsedChord:
    """Parsea cifrados como 'Cmaj7', 'F#m7b5', 'Bb13(#11)', 'G7(b9,b13)/B', 'Dø', 'E°7'."""
    m = _SYMBOL_RE.match(text)
    if not m:
        raise ValueError(f"Cifrado no reconocido: {text!r}")
    root = parse_note(m.group(1))
    suffix = m.group(2).strip()
    bass = parse_note(m.group(3)) if m.group(3) else None

    paren: list[str] = []
    # "m(maj7)" lleva paréntesis pero es un tipo de acorde, no una lista de tensiones.
    # Solo se toma como tensiones el último grupo entre paréntesis ("Cm(maj7)(9)").
    pm = None if suffix in _SUFFIX_ALIASES else re.search(r"\(([^)]*)\)$", suffix) or re.search(r"\(([^)]*)\)", suffix)
    if pm:
        paren = [p.strip().replace("add", "") for p in re.split(r"[,\s]+", pm.group(1)) if p.strip()]
        suffix = (suffix[: pm.start()] + suffix[pm.end():]).strip()
    if suffix not in _SUFFIX_ALIASES:
        raise ValueError(f"Tipo de acorde no reconocido en {text!r}: '{suffix}'")
    base_suffix, tensions = _SUFFIX_ALIASES[suffix]
    base = BASE_BY_SUFFIX[base_suffix]
    all_t = list(tensions)
    for p in paren:
        p = p.replace("♭", "b").replace("♯", "#")
        if p in ("maj7", "M7", "∆7", "Δ7"):
            p = "7"
        if p not in TONES or p in ("1", "3", "b3", "5"):
            raise ValueError(f"Tensión no reconocida en {text!r}: '{p}'")
        if p not in all_t:
            all_t.append(p)
    return ParsedChord(root, base, tuple(sorted(all_t, key=_safe_order)), bass, text.strip())


def _safe_order(t: str) -> int:
    order = ["b9", "9", "#9", "11", "#11", "b5", "#5", "b13", "13", "6", "7"]
    return order.index(t) if t in order else 99


def parse_progression(text: str) -> list[ParsedChord]:
    """Separa por espacios, comas o barras de compás ('Dm7 G7 | Cmaj7')."""
    # Tokenizador en vez de split: los paréntesis pueden llevar comas y espacios
    # ("G7(b9, b13)") y no deben partir el acorde.
    tokens = [t for t in re.findall(r"[^\s,|()]+(?:\([^)]*\))*(?:/[^\s,|()]+)?", text) if t not in ("-", "%")]
    return [parse_symbol(t) for t in tokens]


def voicing_midi(pcs: list[int], bass_pc: int, center: int = 60) -> list[int]:
    """Voicing sencillo y legible: bajo en la octava 2-3 y el resto en posición cerrada."""
    bass = 36 + bass_pc if bass_pc >= 4 else 48 + bass_pc
    upper: list[int] = []
    start = center - 5
    for pc in pcs:
        n = start + ((pc - start) % 12)
        upper.append(n)
    return [bass] + sorted(set(upper))


def all_symbols_for_tests() -> list[str]:
    """Utilidad para tests: todos los sufijos conocidos sobre Do."""
    return ["C" + s for s in _SUFFIX_ALIASES]


