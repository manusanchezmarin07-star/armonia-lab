"""Análisis de audio: pulso, tonalidad y acordes por tiempo a partir del cromagrama.

Método (clásico y robusto, sin redes neuronales extra):
1. Se suman las pistas armónicas (sin batería) y se extrae la parte armónica (HPSS).
2. Se detecta el pulso (beat tracking) y se calcula un cromagrama CQT promediado por pulso.
3. Cada pulso se compara con plantillas de acordes (tríadas y cuatriadas en las 12 raíces).
4. Un Viterbi con premio a "quedarse en el mismo acorde" suaviza los saltos espurios.
5. El bajo se toma de la pista de bajo (si existe) para detectar inversiones.

Es un análisis aproximado: por eso la interfaz permite corregir cada acorde con el MIDI.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.domain.chords import BASE_BY_SUFFIX, TONES, chord_suffix
from app.domain.pitch import pc_name

SR = 22050
HOP = 512

# Tipos de acorde que se buscan en audio. Más tipos = más confusiones, así que se
# limita a los que el cromagrama distingue con fiabilidad.
TEMPLATE_TYPES = ["", "m", "7", "maj7", "m7", "dim", "m7b5", "dim7", "sus4"]
# Penalización por complejidad: ante la duda, mejor una tríada que una cuatriada.
TYPE_PRIOR = {"": 0.0, "m": 0.0, "7": 0.02, "maj7": 0.03, "m7": 0.03, "dim": 0.08, "m7b5": 0.06, "dim7": 0.07, "sus4": 0.08}

# Perfiles de Krumhansl-Kessler para estimar la tonalidad.
_KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


@dataclass
class Template:
    root: int
    suffix: str
    vec: np.ndarray

    @property
    def symbol(self) -> str:
        return pc_name(self.root) + chord_suffix(BASE_BY_SUFFIX[self.suffix], ())

    @property
    def pcs(self) -> list[int]:
        return [(self.root + TONES[t][0]) % 12 for t in BASE_BY_SUFFIX[self.suffix].tones]


def _templates() -> list[Template]:
    out = []
    for root in range(12):
        for suf in TEMPLATE_TYPES:
            v = np.zeros(12)
            for t in BASE_BY_SUFFIX[suf].tones:
                # La fundamental pesa más: suele ser la nota con más energía.
                v[(root + TONES[t][0]) % 12] = 1.15 if t == "1" else 1.0
            out.append(Template(root, suf, v / np.linalg.norm(v)))
    return out


TEMPLATES = _templates()


def load_mono(paths: list[str]) -> np.ndarray:
    import librosa
    signals = [librosa.load(p, sr=SR, mono=True)[0] for p in paths]
    if not signals:
        return np.zeros(SR)
    # Las pistas de Demucs miden lo mismo, pero se rellena por si algún formato
    # añade unas muestras de más al decodificar.
    n = max(len(a) for a in signals)
    return np.sum([np.pad(a, (0, n - len(a))) for a in signals], axis=0)


def estimate_key(chroma_mean: np.ndarray) -> tuple[int, str]:
    best, best_r = (0, "major"), -2.0
    for tonic in range(12):
        for mode, prof in (("major", _KK_MAJOR), ("minor", _KK_MINOR)):
            r = np.corrcoef(chroma_mean, np.roll(prof, tonic))[0, 1]
            if r > best_r:
                best, best_r = (tonic, mode), r
    return best


def analyze(harmonic_paths: list[str], bass_path: str | None = None) -> dict:
    """Devuelve tempo, pulsos, tonalidad estimada y segmentos de acordes."""
    import librosa

    y = load_mono(harmonic_paths)
    duration = len(y) / SR
    y_h = librosa.effects.harmonic(y, margin=3.0)
    tempo, beats = librosa.beat.beat_track(y=y, sr=SR, hop_length=HOP, units="frames")
    tempo = float(np.atleast_1d(tempo)[0])
    chroma = librosa.feature.chroma_cqt(y=y_h, sr=SR, hop_length=HOP, bins_per_octave=36)
    # Compresión (raíz cuadrada): la nota del bajo suele dominar el cromagrama y
    # taparía las 7ªs y 3ªs, que son justo las que definen el tipo de acorde.
    chroma = np.sqrt(chroma)
    n_frames = chroma.shape[1]
    if len(beats) < 4:
        # Sin pulso claro (música rubato): segmentos fijos de medio segundo.
        step = max(1, int(0.5 * SR / HOP))
        beats = np.arange(0, n_frames, step)
    bounds = np.unique(np.concatenate([[0], beats, [n_frames]])).astype(int)
    seg_chroma = np.stack([np.median(chroma[:, a:b], axis=1) if b > a else chroma[:, min(a, n_frames - 1)]
                           for a, b in zip(bounds[:-1], bounds[1:])], axis=1)
    times = librosa.frames_to_time(bounds, sr=SR, hop_length=HOP)

    bass_pcs = None
    if bass_path:
        yb = load_mono([bass_path])
        cb = librosa.feature.chroma_cqt(y=yb, sr=SR, hop_length=HOP, fmin=librosa.note_to_hz("C1"), n_octaves=4)
        bass_pcs = [int(np.argmax(np.median(cb[:, a:b], axis=1))) if b > a else None
                    for a, b in zip(bounds[:-1], bounds[1:])]

    labels, conf = _viterbi(seg_chroma)
    key_tonic, key_mode = estimate_key(chroma.mean(axis=1))

    segments = []
    for i, (li, c) in enumerate(zip(labels, conf)):
        t = TEMPLATES[li]
        energy = float(seg_chroma[:, i].sum())
        sym = t.symbol if energy > 1e-3 else "N"
        bass = bass_pcs[i] if bass_pcs else None
        if sym != "N" and bass is not None and bass != t.root and bass in t.pcs:
            sym += "/" + pc_name(bass)
        if segments and segments[-1]["symbol"] == sym:
            segments[-1]["end"] = float(times[i + 1])
            segments[-1]["confidence"] = round((segments[-1]["confidence"] + c) / 2, 2)
        else:
            segments.append({"start": float(times[i]), "end": float(times[i + 1]), "symbol": sym,
                             "pcs": t.pcs if sym != "N" else [], "confidence": round(c, 2), "edited": False})
    return {"duration": duration, "tempo": round(tempo, 1), "beats": librosa.frames_to_time(beats, sr=SR, hop_length=HOP).tolist(),
            "key": pc_name(key_tonic) + ("m" if key_mode == "minor" else ""), "segments": segments}


def _viterbi(seg_chroma: np.ndarray, stay: float = 0.08) -> tuple[list[int], list[float]]:
    """Decodifica la secuencia de acordes más probable con premio por permanecer."""
    norms = np.linalg.norm(seg_chroma, axis=0) + 1e-9
    X = seg_chroma / norms
    T = np.stack([t.vec for t in TEMPLATES])
    prior = np.array([TYPE_PRIOR[t.suffix] for t in TEMPLATES])
    sims = T @ X - prior[:, None]  # (plantillas, segmentos)
    n_t, n_s = sims.shape
    score = sims[:, 0].copy()
    back = np.zeros((n_t, n_s), dtype=int)
    for s in range(1, n_s):
        best_prev = int(np.argmax(score))
        stay_score = score + stay
        switch = score[best_prev]
        choose_stay = stay_score >= switch
        back[:, s] = np.where(choose_stay, np.arange(n_t), best_prev)
        score = np.where(choose_stay, stay_score, switch) + sims[:, s]
    path = [int(np.argmax(score))]
    for s in range(n_s - 1, 0, -1):
        path.append(int(back[path[-1], s]))
    path.reverse()
    # Confianza: margen entre la plantilla elegida y la mejor alternativa de otra raíz/tipo.
    conf = []
    for s, p in enumerate(path):
        col = np.sort(sims[:, s])[::-1]
        conf.append(float(np.clip((sims[p, s] - col[1]) * 5 + 0.5, 0, 1)) if sims[p, s] >= col[1] else 0.3)
    return path, conf
