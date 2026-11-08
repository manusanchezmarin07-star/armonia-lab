"""Banco de pruebas realista: canciones MIDI renderizadas con instrumentos sampleados
(banco General MIDI FluidR3 vía FluidSynth): piano, piano eléctrico, cuerdas,
guitarra, órgano, bajo eléctrico y batería, con humanización de tiempo y dinámica.

Requiere el ejecutable `fluidsynth` y un banco .sf2 (en Linux: paquete fluid-soundfont-gm).
Uso:  python -m tests.chord_bench_real [n_canciones] [semilla_inicial]
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pretty_midi

from app.domain.chords import BASE_BY_SUFFIX, TONES
from tests.chord_bench import DIATONIC, TYPES, Label, score

SF2_CANDIDATES = ["/usr/share/sounds/sf2/FluidR3_GM.sf2", "/usr/share/soundfonts/FluidR3_GM.sf2"]
# Programas General MIDI para la parte armónica (0 = piano de cola, 4 = piano eléctrico,
# 48 = sección de cuerdas, 24 = guitarra de nylon, 16 = órgano, 89 = pad cálido).
HARMONY_PROGRAMS = [0, 0, 4, 48, 24, 16, 89]


def available() -> bool:
    return shutil.which("fluidsynth") is not None and any(Path(p).exists() for p in SF2_CANDIDATES)


def _sf2() -> str:
    return next(p for p in SF2_CANDIDATES if Path(p).exists())


def _render(pm: pretty_midi.PrettyMIDI, path: Path) -> str:
    mid = path.with_suffix(".mid")
    pm.write(str(mid))
    subprocess.run(["fluidsynth", "-ni", "-g", "0.8", "-F", str(path), "-r", "22050", _sf2(), str(mid)],
                   check=True, capture_output=True)
    return str(path)


def make_song(seed: int, out: Path) -> tuple[dict[str, str], list[Label]]:
    rng = np.random.default_rng(seed)
    key = int(rng.integers(0, 12))
    tempo = float(rng.uniform(70, 130))
    beat = 60 / tempo
    n = int(rng.integers(8, 13))
    chords = []
    for _ in range(n):
        if rng.random() < 0.7:
            suf, deg = DIATONIC[int(rng.integers(0, len(DIATONIC)))]
            chords.append(((key + deg) % 12, suf))
        else:
            chords.append((int(rng.integers(0, 12)), TYPES[int(rng.integers(0, len(TYPES)))]))
    lengths = [int(rng.choice([4, 8])) for _ in chords]
    program = int(rng.choice(HARMONY_PROGRAMS))
    style = rng.choice(["bloque", "arpegio", "sincopado"])

    harm = pretty_midi.Instrument(program=program)
    bass = pretty_midi.Instrument(program=33)  # bajo eléctrico
    drums = pretty_midi.Instrument(program=0, is_drum=True)
    hum = lambda: float(rng.normal(0, 0.012))  # noqa: E731  humanización de tiempo (~12 ms)
    labels, t = [], 0.5
    for (root, suf), beats_n in zip(chords, lengths):
        dur = beats_n * beat
        tones = [TONES[x][0] for x in BASE_BY_SUFFIX[suf].tones]
        inv = int(rng.integers(0, len(tones)))
        voicing = sorted(60 + ((root + s - 60) % 12) + (12 if i < inv else 0) for i, s in enumerate(tones))
        if style == "bloque":
            for b in range(0, beats_n, 2):
                st = t + b * beat + hum()
                for m in voicing:
                    harm.notes.append(pretty_midi.Note(int(rng.integers(55, 90)), m, max(0, st), st + beat * 1.9))
        elif style == "arpegio":
            for k in range(beats_n * 2):
                st = t + k * beat / 2 + hum()
                m = voicing[k % len(voicing)]
                harm.notes.append(pretty_midi.Note(int(rng.integers(55, 85)), m, max(0, st), st + beat))
        else:  # sincopado: acordes en "y" del pulso, típico de pop/funk
            for b in range(beats_n):
                st = t + (b + 0.5) * beat + hum()
                for m in voicing:
                    harm.notes.append(pretty_midi.Note(int(rng.integers(50, 85)), m, max(0, st), st + beat * 0.45))
        for b in range(0, beats_n, 2):
            bn = 36 + root if root >= 4 else 48 + root
            if b % 4 == 2 and rng.random() < 0.4:
                bn += 7
            st = t + b * beat + hum()
            bass.notes.append(pretty_midi.Note(int(rng.integers(70, 100)), bn, max(0, st), st + beat * 1.8))
        for b in range(beats_n):
            st = t + b * beat
            drums.notes.append(pretty_midi.Note(100 if b % 2 == 0 else 60, 36 if b % 2 == 0 else 38, st, st + 0.1))
            for h in (0, 0.5):
                drums.notes.append(pretty_midi.Note(70, 42, st + h * beat, st + h * beat + 0.05))
        labels.append(Label(t, t + dur, root, suf))
        t += dur
    files = {}
    for name, insts in (("mix", [harm, bass, drums]), ("harm", [harm]), ("bass", [bass])):
        pm = pretty_midi.PrettyMIDI(initial_tempo=tempo)
        pm.instruments.extend(insts)
        files[name] = _render(pm, out / f"{seed}_{name}.wav")
    return files, labels


def run(n: int = 8, offset: int = 0) -> dict:
    from app.infrastructure.audio_analysis import analyze
    totals: dict[str, list[float]] = {}
    with tempfile.TemporaryDirectory() as tmp:
        for seed in range(offset, offset + n):
            files, labels = make_song(seed, Path(tmp))
            for scenario, kw in (("mezcla", {"harmonic_paths": [files["mix"]]}),
                                 ("pistas", {"harmonic_paths": [files["harm"]], "bass_path": files["bass"]})):
                res = analyze(**kw)
                for metric, v in score(res["segments"], labels).items():
                    totals.setdefault(f"{scenario}.{metric}", []).append(v)
    return {k: round(float(np.mean(v)) * 100, 1) for k, v in sorted(totals.items())}


if __name__ == "__main__":
    print(run(int(sys.argv[1]) if len(sys.argv) > 1 else 8, int(sys.argv[2]) if len(sys.argv) > 2 else 0))
