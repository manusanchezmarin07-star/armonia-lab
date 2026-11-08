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
TYPE_PRIOR = {"": 0.0, "m": 0.0, "7": 0.0, "maj7": 0.0, "m7": 0.0, "dim": 0.03, "m7b5": 0.01, "dim7": 0.03, "sus4": 0.05}

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


# Perfil armónico de una nota en el cromagrama: el 2º y 4º armónico caen en la misma
# clase de altura, el 3º en la 5ª y el 5º en la 3ª mayor. Incluirlos hace que la
# plantilla se parezca a un instrumento real y no confunda, p. ej., C con Em.
_HARMONICS = [(0, 1.0), (0, 0.6), (7, 0.45), (0, 0.3), (4, 0.25)]


def _templates() -> list[Template]:
    out = []
    for root in range(12):
        for suf in TEMPLATE_TYPES:
            v = np.zeros(12)
            for t in BASE_BY_SUFFIX[suf].tones:
                pc = (root + TONES[t][0]) % 12
                for shift, amp in _HARMONICS:
                    v[(pc + shift) % 12] += amp * (1.15 if t == "1" else 1.0)
            v = np.sqrt(v)  # misma compresión que el cromagrama observado
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


def _bass_profile(y: np.ndarray, bounds: np.ndarray) -> np.ndarray:
    """Distribución de la nota del bajo por segmento (12 × n), de 0 a 1."""
    import librosa
    cb = librosa.feature.chroma_cqt(y=y, sr=SR, hop_length=HOP, fmin=librosa.note_to_hz("C1"), n_octaves=3)
    n = cb.shape[1]
    prof = np.stack([cb[:, a:b].mean(axis=1) if b > a else cb[:, min(a, n - 1)] for a, b in zip(bounds[:-1], bounds[1:])], axis=1)
    prof = prof / (prof.max(axis=0, keepdims=True) + 1e-9)
    return prof ** 2  # realza la nota dominante del bajo


def _key_pcs(tonic: int, mode: str) -> set[int]:
    steps = (0, 2, 4, 5, 7, 9, 11) if mode == "major" else (0, 2, 3, 5, 7, 8, 10, 11)  # menor natural + sensible
    return {(tonic + s) % 12 for s in steps}


def analyze(harmonic_paths: list[str], bass_path: str | None = None) -> dict:
    """Devuelve tempo, pulsos, tonalidad estimada y segmentos de acordes (con alternativas)."""
    import librosa

    y = load_mono(harmonic_paths)
    duration = len(y) / SR
    y_h = librosa.effects.harmonic(y, margin=3.0)
    tempo, beats = librosa.beat.beat_track(y=y, sr=SR, hop_length=HOP, units="frames")
    tempo = float(np.atleast_1d(tempo)[0])
    # Las grabaciones rara vez están exactamente a La 440: se estima la desviación y
    # se corrige; si no, las notas se reparten entre dos casillas del cromagrama.
    tuning = float(librosa.estimate_tuning(y=y_h, sr=SR))
    # El acorde se lee de Do3 hacia arriba: el bajo (muy fuerte en una mezcla) se
    # analiza aparte y aquí taparía las 3ªs, 7ªs y 5ªs alteradas.
    chroma = librosa.feature.chroma_cqt(y=y_h, sr=SR, hop_length=HOP, bins_per_octave=36, tuning=tuning,
                                        fmin=librosa.note_to_hz("C3"), n_octaves=5)
    # Compresión (raíz cuadrada): la nota más fuerte no debe tapar 3ªs y 7ªs.
    chroma = np.sqrt(chroma)
    n_frames = chroma.shape[1]
    if len(beats) < 4:
        # Sin pulso claro (música rubato): segmentos fijos de medio segundo.
        step = max(1, int(0.5 * SR / HOP))
        beats = np.arange(0, n_frames, step)
    bounds = np.unique(np.concatenate([[0], beats, [n_frames]])).astype(int)
    # Media (no mediana) por pulso: en un arpegio cada nota suena solo parte del pulso
    # y la mediana la descartaría.
    seg_chroma = np.stack([chroma[:, a:b].mean(axis=1) if b > a else chroma[:, min(a, n_frames - 1)]
                           for a, b in zip(bounds[:-1], bounds[1:])], axis=1)
    times = librosa.frames_to_time(bounds, sr=SR, hop_length=HOP)

    # El bajo indica la fundamental casi siempre: se usa la pista de bajo si existe
    # y, si no, la zona grave de la propia mezcla.
    bass = _bass_profile(load_mono([bass_path]) if bass_path else y_h, bounds)
    key_tonic, key_mode = estimate_key(chroma.mean(axis=1))
    sims = _similarities(seg_chroma, bass, _key_pcs(key_tonic, key_mode))
    labels = _viterbi(sims)

    segments = []
    i = 0
    while i < len(labels):
        j = i
        while j + 1 < len(labels) and labels[j + 1] == labels[i]:
            j += 1
        t = TEMPLATES[labels[i]]
        energy = float(seg_chroma[:, i:j + 1].sum())
        block = sims[:, i:j + 1].mean(axis=1)
        order = np.argsort(block)[::-1]
        margin = float(block[order[0]] - block[order[1]]) if order[0] == labels[i] else 0.0
        conf = float(np.clip(margin * 6 + 0.45, 0.05, 1.0))
        sym = t.symbol if energy > 1e-3 else "N"
        bass_pc = int(np.argmax(bass[:, i:j + 1].mean(axis=1)))
        if sym != "N" and bass_pc != t.root and bass_pc in t.pcs:
            sym += "/" + pc_name(bass_pc)
        alternatives = [TEMPLATES[k].symbol for k in order[:5] if k != labels[i]][:3]
        segments.append({"start": float(times[i]), "end": float(times[j + 1]), "symbol": sym,
                         "pcs": t.pcs if sym != "N" else [], "confidence": round(conf, 2), "edited": False,
                         "alternatives": alternatives})
        i = j + 1
    segments = _merge_short(segments, min_len=60 / max(tempo, 40) * 0.99)
    return {"duration": duration, "tempo": round(tempo, 1), "beats": librosa.frames_to_time(beats, sr=SR, hop_length=HOP).tolist(),
            "key": pc_name(key_tonic) + ("m" if key_mode == "minor" else ""), "segments": segments, "tuning_cents": round(tuning * 100)}


def _similarities(seg_chroma: np.ndarray, bass: np.ndarray, key_pcs: set[int]) -> np.ndarray:
    """Puntuación de cada plantilla en cada pulso: parecido del cromagrama + bajo + tonalidad."""
    X = seg_chroma / (np.linalg.norm(seg_chroma, axis=0) + 1e-9)
    T = np.stack([t.vec for t in TEMPLATES])
    prior = np.array([TYPE_PRIOR[t.suffix] for t in TEMPLATES])
    roots = np.array([t.root for t in TEMPLATES])
    # Bonificación si el bajo toca la fundamental (o, menos, otra nota del acorde: inversión).
    tone_mask = np.zeros((len(TEMPLATES), 12))
    for k, t in enumerate(TEMPLATES):
        tone_mask[k, t.pcs] = 1
    bass_root = bass[roots, :]
    bass_tone = (tone_mask @ bass) / tone_mask.sum(axis=1, keepdims=True)
    diatonic = np.array([0.03 if set(t.pcs) <= key_pcs else 0.0 for t in TEMPLATES])
    return T @ X - prior[:, None] + 0.12 * bass_root + 0.04 * bass_tone + diatonic[:, None]


def _merge_short(segments: list[dict], min_len: float) -> list[dict]:
    """Funde segmentos más cortos que un pulso con el vecino: suelen ser notas de paso."""
    out: list[dict] = []
    for s in segments:
        if out and (s["end"] - s["start"] < min_len) and s["symbol"] != "N":
            out[-1]["end"] = s["end"]
            continue
        if out and out[-1]["symbol"] == s["symbol"]:
            out[-1]["end"] = s["end"]
            continue
        out.append(dict(s))
    return out


def _viterbi(sims: np.ndarray, stay: float = 0.08) -> list[int]:
    """Secuencia de acordes más probable con premio por permanecer en el mismo acorde."""
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
    return path


def vocal_phrases(path: str, min_gap: float = 0.45, min_len: float = 0.5) -> list[tuple[float, float]]:
    """Tramos en los que se canta, a partir de la energía de la pista de voz separada.

    Sirve para colocar una letra pegada sin transcripción automática: cada verso
    suele coincidir con una frase entre respiraciones.
    """
    import librosa
    y = load_mono([path])
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    if rms.max() <= 0:
        return []
    db = 20 * np.log10(rms / rms.max() + 1e-9)
    active = db > -32
    times = librosa.frames_to_time(np.arange(len(rms)), sr=SR, hop_length=HOP)
    spans, start = [], None
    for t, a in zip(times, active):
        if a and start is None:
            start = t
        elif not a and start is not None:
            spans.append([start, t])
            start = None
    if start is not None:
        spans.append([start, float(times[-1])])
    merged: list[list[float]] = []
    for s in spans:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [(round(a, 2), round(b, 2)) for a, b in merged if b - a >= min_len]
