"""Tonalidades, acordes diatónicos, grados romanos y funciones armónicas."""
from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property

from .chords import BASE_BY_SUFFIX, TONES, chord_suffix, spell_chord
from .pitch import SpelledNote, letter_up, parse_note, spell_pc

MAJOR_STEPS = (0, 2, 4, 5, 7, 9, 11)
NATURAL_MINOR_STEPS = (0, 2, 3, 5, 7, 8, 10)
HARMONIC_MINOR_STEPS = (0, 2, 3, 5, 7, 8, 11)
MELODIC_MINOR_STEPS = (0, 2, 3, 5, 7, 9, 11)

ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"]

# Funciones tonales clásicas (T = tónica, S = subdominante, D = dominante).
MAJOR_FUNCTIONS = ["T", "S", "T", "S", "D", "T", "D"]
MINOR_FUNCTIONS = ["T", "S", "T", "S", "D", "S", "D"]
FUNCTION_ES = {"T": "Tónica (reposo)", "S": "Subdominante (alejamiento)", "D": "Dominante (tensión)"}

# Modos paralelos de los que se suelen "tomar prestados" acordes (intercambio modal).
PARALLEL_MODES = {
    "menor natural (eólico)": NATURAL_MINOR_STEPS,
    "dórico": (0, 2, 3, 5, 7, 9, 10),
    "frigio": (0, 1, 3, 5, 7, 8, 10),
    "lidio": (0, 2, 4, 6, 7, 9, 11),
    "mixolidio": (0, 2, 4, 5, 7, 9, 10),
    "mayor (jónico)": MAJOR_STEPS,
}


def _quality_from_stack(third: int, fifth: int, seventh: int | None) -> str:
    """Sufijo base a partir de los intervalos apilados en terceras."""
    triad = {(4, 7): "", (3, 7): "m", (3, 6): "dim", (4, 8): "aug"}[(third, fifth)]
    if seventh is None:
        return triad
    return {
        ("", 11): "maj7", ("", 10): "7", ("m", 10): "m7", ("m", 11): "m(maj7)",
        ("dim", 10): "m7b5", ("dim", 9): "dim7", ("aug", 11): "maj7#5", ("aug", 10): "7#5",
    }[(triad, seventh)]


def roman_for(degree: int, suffix: str, accidental: str = "") -> str:
    """Grado romano con mayúscula/minúscula según la calidad (ii, V7, vii°7, bVII...)."""
    numeral = ROMAN[degree]
    lower = suffix.startswith("m") and not suffix.startswith("maj") or suffix in ("dim", "dim7", "m7b5")
    numeral = numeral.lower() if lower else numeral
    deco = {
        "": "", "m": "", "dim": "°", "aug": "+", "7": "7", "maj7": "maj7", "m7": "7",
        "m(maj7)": "(maj7)", "m7b5": "ø7", "dim7": "°7", "maj7#5": "+maj7", "7#5": "+7",
        "6": "6", "m6": "6", "sus4": "sus4", "sus2": "sus2", "7sus4": "7sus4", "7b5": "7(b5)",
        "5": "5",
    }.get(suffix, suffix)
    return accidental + numeral + deco


@dataclass(frozen=True)
class Key:
    tonic: SpelledNote
    mode: str  # 'major' | 'minor'

    @staticmethod
    def parse(text: str) -> Key:
        """'C', 'Am', 'F# minor', 'Eb major', 'c' (minúscula = menor, notación clásica)."""
        t = text.strip().replace("major", "").replace("mayor", "").strip()
        minor = False
        for suf in (" minor", " menor", "minor", "menor", "m"):
            if t.endswith(suf):
                t, minor = t[: -len(suf)].strip(), True
                break
        if not minor and t and t[0].islower():
            minor = True
        return Key(parse_note(t), "minor" if minor else "major")

    @property
    def name(self) -> str:
        return f"{self.tonic.name} {'mayor' if self.mode == 'major' else 'menor'}"

    @property
    def short(self) -> str:
        return self.tonic.name + ("m" if self.mode == "minor" else "")

    @property
    def steps(self) -> tuple[int, ...]:
        return MAJOR_STEPS if self.mode == "major" else NATURAL_MINOR_STEPS

    @cached_property
    def scale(self) -> list[SpelledNote]:
        return [spell_pc((self.tonic.pc + s) % 12, letter_up(self.tonic.letter, i))
                for i, s in enumerate(self.steps)]

    @property
    def pcs(self) -> set[int]:
        pcs = {(self.tonic.pc + s) % 12 for s in self.steps}
        if self.mode == "minor":
            # En menor la sensible (7ª elevada) y la 6ª elevada forman parte del
            # lenguaje diatónico (menor armónica y melódica), no son "cromatismos".
            pcs |= {(self.tonic.pc + 9) % 12, (self.tonic.pc + 11) % 12}
        return pcs

    @property
    def accidental_preference(self) -> str:
        flats = sum(1 for n in self.scale if n.alter < 0)
        sharps = sum(1 for n in self.scale if n.alter > 0)
        if flats > sharps:
            return "flat"
        if sharps > flats:
            return "sharp"
        return "default"

    def diatonic_chords(self, sevenths: bool = True) -> list[dict]:
        """Acordes construidos por terceras sobre cada grado.

        En menor se usa la menor armónica para V y vii (lo que se toca en la
        práctica común) y la natural para el resto.
        """
        out = []
        for deg in range(7):
            steps = list(self.steps)
            if self.mode == "minor" and deg in (4, 6):
                steps = list(HARMONIC_MINOR_STEPS)
            root_s = steps[deg]

            def iv(k: int, steps=steps, deg=deg, root_s=root_s) -> int:
                return (steps[(deg + k) % 7] - root_s) % 12

            suffix = _quality_from_stack(iv(2), iv(4), iv(6) if sevenths else None)
            root = spell_pc((self.tonic.pc + root_s) % 12, letter_up(self.tonic.letter, deg))
            base = BASE_BY_SUFFIX[suffix]
            fn = (MAJOR_FUNCTIONS if self.mode == "major" else MINOR_FUNCTIONS)[deg]
            out.append({
                "degree": deg, "roman": roman_for(deg, suffix), "symbol": root.name + chord_suffix(base, ()),
                "root": root.name, "root_pc": root.pc, "suffix": suffix,
                "notes": spell_chord(root, list(base.tones)),
                "pcs": [(root.pc + TONES[t][0]) % 12 for t in base.tones],
                "function": fn, "function_es": FUNCTION_ES[fn],
            })
        return out

    def diatonic_pcs_for_degree(self, deg: int) -> list[set[int]]:
        """Notas permitidas para un acorde sobre el grado `deg`.

        En menor, la sensible solo se admite en los acordes de V y vii (menor
        armónica), aunque también valen sus versiones naturales (v, VII). Si se admitiera siempre, D7 o G7 contarían como diatónicos en
        La menor y el análisis confundiría C mayor con su relativa menor.
        """
        base = {(self.tonic.pc + s) % 12 for s in self.steps}
        if self.mode == "minor" and deg in (4, 6):
            # v/V y VII/vii° conviven en menor: se acepta la versión natural o la armónica.
            harmonic = {(self.tonic.pc + s) % 12 for s in HARMONIC_MINOR_STEPS}
            return [base, harmonic]
        return [base]

    def degree_of(self, pc: int) -> int | None:
        rel = (pc - self.tonic.pc) % 12
        if rel in self.steps:
            return self.steps.index(rel)
        if self.mode == "minor" and rel == 11:
            return 6
        if self.mode == "minor" and rel == 9:
            return 5
        return None

    def chromatic_roman(self, root_pc: int, suffix: str) -> str:
        """Grado romano para una fundamental fuera de la escala (bII, bVI, #IV...)."""
        rel = (root_pc - self.tonic.pc) % 12
        deg = self.degree_of(root_pc)
        if deg is not None:
            return roman_for(deg, suffix)
        # Se nombra respecto a la escala mayor de la tónica (convención de jazz/pop:
        # bII, bIII, bVI, bVII). El tritono se llama #IV salvo en acordes mayores
        # o dominantes, donde suele leerse como bV (p. ej. sustituto tritonal).
        mapping = {1: (1, "b"), 3: (2, "b"), 6: (3, "#"), 8: (5, "b"), 10: (6, "b"),
                   2: (1, ""), 4: (2, ""), 9: (5, ""), 11: (6, "")}
        if rel == 6 and suffix in ("", "7", "maj7"):
            return roman_for(4, suffix, "b")
        d, acc = mapping[rel]
        if self.mode == "minor" and rel in (4, 9, 11):
            acc = "#" if rel != 11 else ""
        return roman_for(d, suffix, acc)


def negative_pc(pc: int, tonic_pc: int) -> int:
    """Refleja una nota respecto al eje de la armonía negativa.

    El eje está entre la 3ª menor y la 3ª mayor de la tónica (en Do, entre Mib y
    Mi), es decir, a medio camino entre tónica y dominante. Por eso Do<->Sol,
    Mi<->Mib, Re<->Fa, Si<->Lab: n' = 2·tónica + 7 − n (mód 12).
    """
    return (2 * tonic_pc + 7 - pc) % 12


def negative_midi(midi: int, tonic_pc: int, around: int = 60) -> int:
    """Versión con registro: refleja la nota MIDI sobre el eje (tónica + 3,5 semitonos)."""
    tonic_midi = around - ((around - tonic_pc) % 12)
    return 2 * tonic_midi + 7 - midi


def analyze_chord_in_key(key: Key, root_pc: int, suffix: str, pcs: list[int]) -> dict:
    """Explica qué papel juega un acorde dentro de una tonalidad.

    Se prueban las explicaciones de la más simple a la más rebuscada (diatónico,
    dominante secundario, sustituto tritonal, préstamo modal...) porque así se
    analiza en armonía funcional: la explicación más sencilla suele ser la correcta.
    """
    base = BASE_BY_SUFFIX.get(suffix)
    core_pcs = {(root_pc + TONES[t][0]) % 12 for t in base.tones} if base else set(pcs)
    family = base.family if base else "?"
    tonic = key.tonic.pc
    rel = (root_pc - tonic) % 12
    roman = key.chromatic_roman(root_pc, suffix)
    diatonic = key.diatonic_chords(sevenths=True)
    diatonic_triads = key.diatonic_chords(sevenths=False)

    def target_info(target_pc: int) -> dict | None:
        deg = key.degree_of(target_pc)
        if deg is None:
            return None
        ch = diatonic_triads[deg]
        if ch["suffix"] == "dim":  # no se tonicizan acordes disminuidos
            return None
        return ch

    res = {"roman": roman, "kind": "cromático", "function": None, "explanation": "", "target": None}

    deg = key.degree_of(root_pc)
    if deg is not None and any(core_pcs <= opt for opt in key.diatonic_pcs_for_degree(deg)):
        fn = (MAJOR_FUNCTIONS if key.mode == "major" else MINOR_FUNCTIONS)[deg]
        res.update(kind="diatónico", function=fn,
                   explanation=f"Acorde propio de {key.name}. Función: {FUNCTION_ES[fn]}.")
        if deg == 4 and family == "dom":
            res["explanation"] += " Su tritono (3ª y 7ª) pide resolver a la tónica."
        return res

    if family in ("dom",) or (suffix == "" and rel != 0):
        t = target_info((root_pc + 5) % 12)
        if t and (root_pc + 5) % 12 != tonic:
            res.update(kind="dominante secundaria", function="D", target=t["symbol"],
                       roman=f"V{'7' if family == 'dom' else ''}/{t['roman']}",
                       explanation=f"Es el dominante de {t['symbol']} ({t['roman']}): lo prepara "
                                   f"creando tensión momentánea hacia ese grado (tonicización).")
            return res

    if family == "dom":
        target_pc = (root_pc - 1) % 12
        # Solo se consideran los destinos habituales del subV (I, ii, IV, V): hacia
        # iii o vi es tan raro que suele haber una explicación mejor (préstamo modal).
        common_target = key.degree_of(target_pc) in (0, 1, 3, 4)
        t = None if not common_target else target_info(target_pc) if target_pc != tonic else {"symbol": key.short, "roman": "I" if key.mode == "major" else "i"}
        if t:
            res.update(kind="sustituto tritonal", function="D", target=t["symbol"],
                       roman=f"subV7/{t['roman']}" if target_pc != tonic else "subV7 (bII7)",
                       explanation=f"Sustituto tritonal: comparte el tritono (3ª y 7ª) con el "
                                   f"dominante normal de {t['symbol']} y resuelve bajando medio tono.")
            return res

    if family in ("dim",) or suffix == "m7b5":
        t = target_info((root_pc + 1) % 12)
        if t:
            res.update(kind="disminuido de paso / sensible secundaria", function="D", target=t["symbol"],
                       roman=f"vii{'°7' if suffix == 'dim7' else ('ø7' if suffix == 'm7b5' else '°')}/{t['roman']}",
                       explanation=f"Funciona como sensible de {t['symbol']}: su fundamental está medio tono "
                                   f"por debajo y todas sus notas resuelven por grado conjunto.")
            return res

    if suffix in ("", "maj7") and rel == 1:
        res.update(kind="napolitano / bII", function="S",
                   explanation="Acorde napolitano (bII): subdominante cromática muy expresiva, "
                               "suele ir al V.")
        return res

    for mode_name, steps in PARALLEL_MODES.items():
        mode_pcs = {(tonic + s) % 12 for s in steps}
        if core_pcs <= mode_pcs and (key.mode == "major" and steps != MAJOR_STEPS
                                     or key.mode == "minor" and steps != NATURAL_MINOR_STEPS):
            res.update(kind="préstamo modal", function="S" if rel in (5, 8, 10, 2) else None,
                       explanation=f"Intercambio modal: el acorde viene de {key.tonic.name} {mode_name}, "
                                   f"el modo paralelo. Mantiene la tónica pero cambia el color.")
            break

    neg = sorted({negative_pc(p, tonic) for p in core_pcs})
    for ch in diatonic + diatonic_triads:
        if set(ch["pcs"]) == set(neg):
            res["negative_of"] = ch["symbol"]
            extra = (f" En armonía negativa es el reflejo de {ch['symbol']} ({ch['roman']}), "
                     f"por eso puede sustituirlo con su misma función ({ch['function_es']}).")
            if res["kind"] == "cromático":
                res.update(kind="armonía negativa", function=ch["function"], explanation=extra.strip())
            else:
                res["explanation"] += extra
            break

    if res["kind"] == "cromático" and suffix in ("", "m") and rel in (3, 4, 8, 9):
        res.update(kind="mediante cromática",
                   explanation="Mediante cromática: fundamental a una 3ª de la tónica, comparte "
                               "una nota con ella y cambia el color de golpe (muy cinematográfico).")
    if res["kind"] == "cromático":
        res["explanation"] = ("Acorde ajeno a la tonalidad sin una explicación funcional clara aquí: "
                              "puede indicar una modulación o un movimiento de color/voces.")
    return res
