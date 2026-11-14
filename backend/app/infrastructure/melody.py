"""Detección de la melodía con pYIN (librosa): la frecuencia fundamental instante a instante.

pYIN sigue UNA nota a la vez. Va muy bien con la voz o con un instrumento melódico
(flauta, violín, la mano derecha de una guitarra punteada) y mal con acordes: por
eso se aplica a una pista separada, no a la mezcla, siempre que se pueda.
"""
from __future__ import annotations

import numpy as np

from app.domain.melody import hz_to_midi, segment_notes, trim_outliers

SR = 22050
HOP = 512  # ≈ 23 ms: suficiente para notas y la mitad de coste que con más resolución


def peak_level(path: str) -> float:
    """Nivel más alto (RMS) de un audio; el de la mezcla sirve de referencia para sus pistas."""
    import librosa
    y, _ = librosa.load(path, sr=SR, mono=True)
    return float(librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP)[0].max()) if len(y) else 0.0


def detect(path: str, ref_peak: float | None = None) -> list[dict]:
    """Notas de la melodía de una pista: [{start, end, midi, name}].

    `ref_peak` es el nivel máximo de la canción entera: lo que en la pista suene 34 dB por
    debajo son restos de otros instrumentos que deja la separación, no melodía.
    """
    import librosa
    y, _ = librosa.load(path, sr=SR, mono=True)
    if len(y) < SR // 2 or float(np.sqrt(np.mean(y ** 2))) < 1e-4:
        return []
    f0, voiced, prob = librosa.pyin(y, sr=SR, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C6"),
                                    frame_length=2048, hop_length=HOP)
    times = librosa.times_like(f0, sr=SR, hop_length=HOP)
    # Además de «con voz», se exige que el tramo suene: pYIN se inventa notas en el ruido de fondo
    # que deja la separación en los silencios.
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP)[0][:len(f0)]
    loud = rms > max(1e-4, float(np.percentile(rms, 95)) * 0.03, (ref_peak or 0.0) * 0.02)
    midi = [hz_to_midi(float(h)) if v and ok and not np.isnan(h) else None for h, v, ok in zip(f0, voiced, loud)]
    return trim_outliers(segment_notes([float(t) for t in times], midi))
