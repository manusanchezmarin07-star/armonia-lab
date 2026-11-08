"""Banco de pruebas del detector de acordes por audio.

Genera canciones sintéticas con verdad conocida (progresiones, inversiones,
arpegios, línea de bajo, batería, desafinación y ruido) y mide el acierto del
detector por fotogramas, como se hace en la evaluación MIREX de acordes.

Uso:  python -m tests.chord_bench [n_canciones]
"""
from __future__ import annotations

import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

from app.domain.chords import BASE_BY_SUFFIX, TONES, parse_symbol

SR = 22050
TYPES = ["", "m", "7", "maj7", "m7", "dim", "m7b5", "sus4"]
MAJOR = [0, 2, 4, 5, 7, 9, 11]
DIATONIC = [("", 0), ("m", 2), ("m", 4), ("", 5), ("7", 7), ("m", 9), ("m7b5", 11), ("maj7", 0), ("m7", 2), ("maj7", 5)]


@dataclass
class Label:
    start: float
    end: float
    root: int
    suffix: str


def _tone(freq: float, dur: float, rng, decay: float = 1.6) -> np.ndarray:
    t = np.arange(int(dur * SR)) / SR
    amps = [1 / k ** rng.uniform(1.0, 1.6) for k in range(1, 8)]
    sig = sum(a * np.sin(2 * np.pi * freq * k * t + rng.uniform(0, 6.28)) for k, a in enumerate(amps, 1))
    env = np.exp(-t * decay) * np.minimum(1, t * 200)
    return sig * env


def _add(buf: np.ndarray, start: int, seg: np.ndarray) -> None:
    end = min(len(buf), start + len(seg))
    if end > start:
        buf[start:end] += seg[: end - start]


def _hz(m: float) -> float:
    return 440 * 2 ** ((m - 69) / 12)


def make_song(seed: int, out: Path) -> tuple[dict[str, str], list[Label]]:
    rng = np.random.default_rng(seed)
    key = int(rng.integers(0, 12))
    tempo = float(rng.uniform(80, 130))
    beat = 60 / tempo
    cents = float(rng.uniform(-35, 35)) / 100  # desafinación global
    style = rng.choice(["bloque", "arpegio"])
    n = int(rng.integers(8, 13))
    chords = []
    for _ in range(n):
        if rng.random() < 0.7:
            suf, deg = DIATONIC[int(rng.integers(0, len(DIATONIC)))]
            chords.append(((key + deg) % 12, suf))
        else:
            chords.append((int(rng.integers(0, 12)), TYPES[int(rng.integers(0, len(TYPES)))]))
    lengths = [int(rng.choice([4, 8])) for _ in chords]
    total = sum(lengths) * beat + 2
    piano = np.zeros(int(total * SR) + SR)
    bass = np.zeros_like(piano)
    drums = np.zeros_like(piano)
    labels, t = [], 0.0
    for (root, suf), beats_n in zip(chords, lengths):
        dur = beats_n * beat
        tones = [TONES[x][0] for x in BASE_BY_SUFFIX[suf].tones]
        inv = int(rng.integers(0, len(tones)))
        voicing = sorted(60 + ((root + s - 60) % 12) + (12 if i < inv else 0) for i, s in enumerate(tones))
        for b in range(beats_n):
            start = int((t + b * beat) * SR)
            if style == "bloque" and b % 2 == 0:
                for m in voicing:
                    seg = _tone(_hz(m + cents), beat * 2, rng) * 0.25
                    _add(piano, start, seg)
            elif style == "arpegio":
                for h in range(2):
                    m = voicing[(b * 2 + h) % len(voicing)]
                    st = start + int(h * beat / 2 * SR)
                    seg = _tone(_hz(m + cents), beat, rng, decay=2.5) * 0.3
                    _add(piano, st, seg)
            if b % 2 == 0:
                bn = 36 + root if root >= 4 else 48 + root
                if b % 4 == 2 and rng.random() < 0.4:
                    bn += 7
                seg = _tone(_hz(bn + cents), beat * 2, rng, decay=0.8) * 0.5
                _add(bass, start, seg)
            # batería: bombo en cada pulso y charles en las corcheas
            kk = np.arange(int(0.15 * SR)) / SR
            kick = np.sin(2 * np.pi * 55 * kk) * np.exp(-kk * 30) * 0.6
            _add(drums, start, kick)
            hat = rng.normal(0, 1, int(0.04 * SR)) * np.exp(-np.arange(int(0.04 * SR)) / SR * 120) * 0.15
            for h in (0, int(beat / 2 * SR)):
                _add(drums, start + h, hat)
        labels.append(Label(t, t + dur, root, suf))
        t += dur
    noise = rng.normal(0, 0.003, len(piano))
    mix = piano + bass + drums + noise
    peak = np.abs(mix).max()
    files = {}
    for name, sig in (("mix", mix), ("piano", piano), ("bass", bass)):
        p = out / f"{seed}_{name}.wav"
        sf.write(p, sig / peak * 0.8, SR)
        files[name] = str(p)
    return files, labels


def _label_at(labels: list[Label], time: float) -> Label | None:
    return next((lb for lb in labels if lb.start <= time < lb.end), None)


FAMILY = {"": "maj", "7": "maj", "maj7": "maj", "aug": "maj", "sus4": "maj", "m": "min", "m7": "min",
          "m7b5": "min", "dim": "min", "dim7": "min", "6": "maj", "m6": "min"}


def score(segments: list[dict], labels: list[Label]) -> dict:
    """Acierto por fotogramas (10 por segundo): fundamental, mayor/menor y tipo exacto."""
    hits = {"raiz": 0, "mayor_menor": 0, "exacto": 0}
    frames = 0
    end = labels[-1].end
    for k in range(int(end * 10)):
        tm = k / 10
        lb = _label_at(labels, tm)
        seg = next((s for s in segments if s["start"] <= tm < s["end"]), None)
        if lb is None:
            continue
        frames += 1
        if not seg or seg["symbol"] == "N":
            continue
        p = parse_symbol(seg["symbol"].split("/")[0])
        if p.root.pc == lb.root:
            hits["raiz"] += 1
            if FAMILY.get(p.base.suffix) == FAMILY.get(lb.suffix):
                hits["mayor_menor"] += 1
            if p.base.suffix == lb.suffix:
                hits["exacto"] += 1
    return {k: v / max(1, frames) for k, v in hits.items()}


def run(n: int = 12, offset: int = 0) -> dict:
    from app.infrastructure.audio_analysis import analyze

    totals: dict[str, list[float]] = {}
    with tempfile.TemporaryDirectory() as tmp:
        for seed in range(offset, offset + n):
            files, labels = make_song(seed, Path(tmp))
            for scenario, kw in (("mezcla", {"harmonic_paths": [files["mix"]]}),
                                 ("pistas", {"harmonic_paths": [files["piano"]], "bass_path": files["bass"]})):
                res = analyze(**kw)
                for metric, v in score(res["segments"], labels).items():
                    totals.setdefault(f"{scenario}.{metric}", []).append(v)
    return {k: round(float(np.mean(v)) * 100, 1) for k, v in sorted(totals.items())}


if __name__ == "__main__":
    print(run(int(sys.argv[1]) if len(sys.argv) > 1 else 12, int(sys.argv[2]) if len(sys.argv) > 2 else 0))
