"""Escalas y modos, incluidas las escalas simétricas (tonos enteros, disminuida,
aumentada y los modos de transposición limitada de Messiaen).

Las escalas se definen por su patrón de intervalos en semitonos. A partir de ahí
todo se calcula (notas, acordes por terceras, número de transposiciones) para no
depender de tablas escritas a mano que puedan contener errores.

Fuentes contrastadas:
- Modos griegos y de la menor melódica: Open Music Theory (viva.pressbooks.pub/openmusictheory).
- Colecciones simétricas y modos de Messiaen: O. Messiaen, *Technique de mon langage
  musical* (1944), resumido en Wikipedia "Mode of limited transposition".
"""
from __future__ import annotations

from dataclasses import dataclass

from .chords import identify
from .pitch import SpelledNote, letter_up, parse_note, pc_name, spell_pc


@dataclass(frozen=True)
class ScaleDef:
    id: str
    name: str
    family: str
    steps: tuple[int, ...]  # intervalos entre notas consecutivas; suman 12
    description: str
    characteristic: tuple[int, ...] = ()  # semitonos desde la tónica de las notas que dan el "color"
    feeling: str = ""

    @property
    def degrees(self) -> list[int]:
        acc, out = 0, []
        for s in self.steps[:-1]:
            out.append(acc)
            acc += s
        out.append(acc)
        return out

    @property
    def transpositions(self) -> int:
        """Número de transposiciones distintas (12 para escalas no simétricas).

        Una escala simétrica se repite al transportarla: la de tonos enteros solo
        tiene 2 versiones distintas y la disminuida 3. Esa repetición es lo que
        permite usarla como "bisagra" entre varias tonalidades a la vez.
        """
        base = frozenset(self.degrees)
        for t in range(1, 13):
            if frozenset((d + t) % 12 for d in base) == base:
                return t
        return 12


_MAJOR_MODE_INFO = [
    ("ionian", "Jónico (mayor)", (), "Luminoso y estable. Es la escala mayor."),
    ("dorian", "Dórico", (9,), "Menor pero con la 6ª mayor: menor 'esperanzado'. Muy usado en jazz, funk y folk."),
    ("phrygian", "Frigio", (1,), "Menor con la 2ª menor: oscuro, con sabor andaluz por ese medio tono sobre la tónica."),
    ("lydian", "Lidio", (6,), "Mayor con la 4ª aumentada: flotante, soñador. Muy querido por Jacob Collier."),
    ("mixolydian", "Mixolidio", (10,), "Mayor con la 7ª menor: el sonido del acorde de dominante, rock y blues."),
    ("aeolian", "Eólico (menor natural)", (8,), "La escala menor natural: melancólica."),
    ("locrian", "Locrio", (1, 6), "2ª menor y 5ª disminuida: inestable, la tónica es un acorde disminuido."),
]
_MAJOR = (2, 2, 1, 2, 2, 2, 1)
_MELODIC = (2, 1, 2, 2, 2, 2, 1)
_HARMONIC = (2, 1, 2, 2, 1, 3, 1)

_MELODIC_MODE_INFO = [
    ("melodic_minor", "Menor melódica (jazz)", (11,), "Menor con 6ª y 7ª mayores: sonido de jazz moderno sobre m(maj7)."),
    ("dorian_b2", "Dórico b2 (frigio #6)", (1, 9), "Sobre acordes sus(b9)."),
    ("lydian_augmented", "Lidio aumentado", (6, 8), "Sobre maj7#5: lidio aún más brillante."),
    ("lydian_dominant", "Lidio dominante (lidio b7)", (6, 10), "Sobre dominantes 7(#11), típica del sustituto tritonal."),
    ("mixolydian_b6", "Mixolidio b6", (8, 10), "Dominante con b13: mayor con un toque menor."),
    ("locrian_n2", "Locrio #2", (2, 6), "La escala del semidisminuido (m7b5) en jazz."),
    ("altered", "Alterada (superlocria)", (1, 3, 4, 6, 8), "Todas las tensiones alteradas: sobre el dominante 7alt."),
]


def _rot(steps: tuple[int, ...], n: int) -> tuple[int, ...]:
    return steps[n:] + steps[:n]


def _build() -> list[ScaleDef]:
    out: list[ScaleDef] = []
    for i, (sid, name, ch, desc) in enumerate(_MAJOR_MODE_INFO):
        out.append(ScaleDef(sid, name, "Modos de la escala mayor", _rot(_MAJOR, i), desc, ch))
    for i, (sid, name, ch, desc) in enumerate(_MELODIC_MODE_INFO):
        out.append(ScaleDef(sid, name, "Modos de la menor melódica", _rot(_MELODIC, i), desc, ch))
    out += [
        ScaleDef("harmonic_minor", "Menor armónica", "Menor armónica y flamenco", _HARMONIC,
                 "Menor con la 7ª elevada (sensible): crea el V7 en menor. Su 2ª aumentada (6ª→7ª) suena 'oriental'.", (8, 11)),
        ScaleDef("phrygian_dominant", "Frigio dominante (5º modo de la menor armónica)", "Menor armónica y flamenco",
                 _rot(_HARMONIC, 4),
                 "Frigio con la 3ª mayor. Es el color de la cadencia andaluza sobre el acorde de tónica mayor "
                 "en el 'modo de Mi' flamenco.", (1, 4)),
        ScaleDef("double_harmonic", "Doble armónica (árabe / bizantina)", "Menor armónica y flamenco",
                 (1, 3, 1, 2, 1, 3, 1), "Dos segundas aumentadas: sonoridad árabe, muy asociada al flamenco y a Oriente.", (1, 4, 8, 11)),
        ScaleDef("major_pentatonic", "Pentatónica mayor", "Pentatónicas y blues", (2, 2, 3, 2, 3),
                 "Cinco notas sin semitonos: imposible que suene 'mal'. Base del folk y el pop."),
        ScaleDef("minor_pentatonic", "Pentatónica menor", "Pentatónicas y blues", (3, 2, 2, 3, 2),
                 "La escala del rock y el blues."),
        ScaleDef("blues", "Blues", "Pentatónicas y blues", (3, 2, 1, 1, 3, 2),
                 "Pentatónica menor más la 'blue note' (5ª disminuida).", (6,)),
        # --- Simétricas ---
        ScaleDef("whole_tone", "Tonos enteros (Messiaen modo 1)", "Escalas simétricas", (2,) * 6,
                 "Solo tonos: no hay tónica clara ni dominante. Suena a sueño (Debussy). "
                 "Solo existen 2 escalas distintas de tonos enteros.", feeling="ingrávido"),
        ScaleDef("octatonic_hw", "Disminuida semitono-tono (Messiaen modo 2)", "Escalas simétricas", (1, 2) * 4,
                 "Alterna semitono y tono. Contiene 4 acordes dominantes a distancia de 3ª menor "
                 "(C7, Eb7, F#7, A7): por eso un solo acorde disminuido conecta 4 tonalidades. "
                 "Se usa sobre dominantes 7(b9,#9,13).", feeling="tenso y simétrico"),
        ScaleDef("octatonic_wh", "Disminuida tono-semitono", "Escalas simétricas", (2, 1) * 4,
                 "La otra rotación de la disminuida: sobre acordes dim7. Solo existen 3 transposiciones."),
        ScaleDef("augmented", "Aumentada (hexatónica)", "Escalas simétricas", (3, 1) * 3,
                 "3ª menor + semitono repetido. Es la unión de dos tríadas aumentadas a distancia de semitono y está muy relacionada con los "
                 "'ciclos de terceras mayores' (como los de Coltrane en Giant Steps)."),
        ScaleDef("messiaen_3", "Messiaen modo 3", "Escalas simétricas", (2, 1, 1) * 3,
                 "Tono-semitono-semitono repetido 3 veces: 9 notas y 4 transposiciones."),
        ScaleDef("messiaen_4", "Messiaen modo 4", "Escalas simétricas", (1, 1, 3, 1) * 2,
                 "Semitono-semitono-3ª menor-semitono repetido 2 veces: 8 notas, 6 transposiciones."),
        ScaleDef("messiaen_5", "Messiaen modo 5", "Escalas simétricas", (1, 4, 1) * 2,
                 "Semitono-3ª mayor-semitono repetido 2 veces: 6 notas, 6 transposiciones."),
        ScaleDef("messiaen_6", "Messiaen modo 6", "Escalas simétricas", (2, 2, 1, 1) * 2,
                 "Tono-tono-semitono-semitono repetido 2 veces: 8 notas, 6 transposiciones."),
        ScaleDef("messiaen_7", "Messiaen modo 7", "Escalas simétricas", (1, 1, 1, 2, 1) * 2,
                 "Semitono×3-tono-semitono repetido 2 veces: 10 notas, 6 transposiciones."),
        ScaleDef("chromatic", "Cromática", "Escalas simétricas", (1,) * 12,
                 "Las 12 notas. Totalmente simétrica: solo existe una."),
    ]
    return out


SCALES: list[ScaleDef] = _build()
SCALES_BY_ID = {s.id: s for s in SCALES}


def spell_scale(tonic: SpelledNote, scale: ScaleDef) -> list[str]:
    """Deletrea la escala. Si tiene 7 notas usa una letra por grado (sin repetir
    letras), que es la norma; si no, nombres por defecto según la tónica."""
    degs = scale.degrees
    if len(degs) == 7:
        return [spell_pc((tonic.pc + d) % 12, letter_up(tonic.letter, i)).name for i, d in enumerate(degs)]
    prefer = "flat" if tonic.alter < 0 or tonic.name == "F" else "sharp" if tonic.alter > 0 else "default"
    return [pc_name(tonic.pc + d, prefer) for d in degs]


def scale_chords(tonic: SpelledNote, scale: ScaleDef) -> list[dict]:
    """Acordes de 4 notas construidos por terceras dentro de la escala (solo heptatónicas)."""
    degs = scale.degrees
    if len(degs) != 7:
        return []
    names = spell_scale(tonic, scale)
    out = []
    for i in range(7):
        pcs = [(tonic.pc + degs[(i + k) % 7]) % 12 for k in (0, 2, 4, 6)]
        readings = identify(pcs, bass=pcs[0], is_midi=False)
        reading = next((r for r in readings if r.root_pc == pcs[0]), readings[0] if readings else None)
        if reading is None:
            continue
        sym = names[i] + reading.symbol[len(reading.root_name):].split("/")[0]
        out.append({"degree": i + 1, "symbol": sym, "pcs": pcs})
    return out


def scale_info(tonic_text: str, scale_id: str) -> dict:
    tonic = parse_note(tonic_text)
    s = SCALES_BY_ID[scale_id]
    return {
        "id": s.id, "name": s.name, "family": s.family, "description": s.description,
        "tonic": tonic.name, "steps": list(s.steps), "degrees": s.degrees,
        "pcs": [(tonic.pc + d) % 12 for d in s.degrees],
        "notes": spell_scale(tonic, s),
        "characteristic_pcs": [(tonic.pc + d) % 12 for d in s.characteristic],
        "transpositions": s.transpositions, "symmetric": s.transpositions < 12,
        "chords": scale_chords(tonic, s),
    }


def scale_catalog() -> list[dict]:
    return [{"id": s.id, "name": s.name, "family": s.family, "symmetric": s.transpositions < 12,
             "size": len(s.degrees), "transpositions": s.transpositions} for s in SCALES]
