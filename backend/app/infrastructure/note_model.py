"""Transcripción de notas con el modelo de basic-pitch (Spotify) ejecutado con onnxruntime.

El modelo devuelve, cada ~11,6 ms, la probabilidad de que suene cada una de las
88 notas del piano. Está entrenado con instrumentos reales, así que distingue
notas que el cromagrama confunde (armónicos, reverberación, mezclas densas).
El pre y posprocesado replica el de basic-pitch (ventanas de 2 s solapadas).
"""
from __future__ import annotations

import importlib.util
from functools import lru_cache
from pathlib import Path

import numpy as np

SR = 22050
FFT_HOP = 256
N_SAMPLES = SR * 2 - FFT_HOP  # 43844: ventana de entrada del modelo
FPS = SR / FFT_HOP            # ≈ 86 fotogramas por segundo
N_OLAP_FRAMES = 30
OLAP_LEN = N_OLAP_FRAMES * FFT_HOP
HOP = N_SAMPLES - OLAP_LEN
LOWEST_MIDI = 21              # La0: la primera de las 88 teclas
MODEL_PATH = Path(__file__).parent / "models" / "basic_pitch_nmp.onnx"
NOTE_OUTPUT = "StatefulPartitionedCall:1"  # "note": nota sonando (la :2 es el ataque y la :0 el contorno)


def available() -> bool:
    return importlib.util.find_spec("onnxruntime") is not None and MODEL_PATH.exists()


@lru_cache(maxsize=1)
def _session():
    import onnxruntime as ort
    providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in ort.get_available_providers()]
    return ort.InferenceSession(str(MODEL_PATH), providers=providers)


def note_activations(y: np.ndarray) -> np.ndarray:
    """Audio mono a 22050 Hz → matriz (88 notas × fotogramas) con valores 0-1."""
    sess = _session()
    n_frames = int(np.floor(len(y) * FPS / SR))
    audio = np.concatenate([np.zeros(OLAP_LEN // 2, dtype=np.float32), y.astype(np.float32)])
    windows = []
    for start in range(0, len(audio), HOP):
        w = audio[start:start + N_SAMPLES]
        if len(w) < N_SAMPLES:
            w = np.pad(w, (0, N_SAMPLES - len(w)))
        windows.append(w)
    batch = np.stack(windows)[:, :, None]
    outs = []
    for i in range(0, len(batch), 16):  # lotes pequeños: memoria acotada en canciones largas
        outs.append(sess.run([NOTE_OUTPUT], {sess.get_inputs()[0].name: batch[i:i + 16]})[0])
    notes = np.concatenate(outs)
    half = N_OLAP_FRAMES // 2
    notes = notes[:, half:-half, :].reshape(-1, 88)[:n_frames]
    return notes.T
