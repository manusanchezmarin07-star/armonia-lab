"""Reconocimiento de instrumentos con AST (Audio Spectrogram Transformer) entrenado en AudioSet.

Se ejecuta en local con `transformers` + PyTorch (GPU si hay). El modelo
(~350 MB) se descarga de Hugging Face la primera vez y queda en caché.
Se analizan ventanas de unos segundos repartidas por la canción para saber no
solo qué suena, sino cuándo.
"""
from __future__ import annotations

import importlib.util
import os

import numpy as np

MODEL = os.environ.get("INSTRUMENT_MODEL", "MIT/ast-finetuned-audioset-10-10-0.4593")
SR = 16000
WINDOW = 6.0       # segundos por ventana
MAX_WINDOWS = 24   # como mucho, para que una canción larga no tarde demasiado
_pipe = None


def available() -> bool:
    return all(importlib.util.find_spec(m) is not None for m in ("transformers", "torch"))


def _pipeline():
    global _pipe
    if _pipe is None:
        import torch
        from transformers import pipeline
        _pipe = pipeline("audio-classification", model=MODEL, device=0 if torch.cuda.is_available() else -1)
    return _pipe


def tag_windows(path: str) -> list[dict]:
    """Devuelve [{start, end, scores:{etiqueta AudioSet: probabilidad}}] para ventanas de la pista."""
    import librosa
    y, _ = librosa.load(path, sr=SR, mono=True)
    dur = len(y) / SR
    n = max(1, min(MAX_WINDOWS, int(dur // WINDOW)))
    starts = np.linspace(0, max(0.0, dur - WINDOW), n)
    pipe = _pipeline()
    out = []
    for st in starts:
        seg = y[int(st * SR):int((st + WINDOW) * SR)]
        if len(seg) < SR or np.sqrt(np.mean(seg ** 2)) < 1e-3:  # silencio: nada que clasificar
            continue
        res = pipe({"raw": seg, "sampling_rate": SR}, top_k=20)
        out.append({"start": float(st), "end": float(min(dur, st + WINDOW)), "scores": {r["label"]: float(r["score"]) for r in res}})
    return out
