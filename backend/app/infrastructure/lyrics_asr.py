"""Transcripción de la letra con Whisper (OpenAI, código abierto, se ejecuta en local).

Se usa sobre la pista de voz separada por Demucs: sin instrumentos, el
reconocimiento es mucho más fiable. El modelo se descarga la primera vez
(«small» ≈ 460 MB) y corre en la GPU si PyTorch tiene CUDA.
"""
from __future__ import annotations

import importlib.util
import os

MODEL = os.environ.get("WHISPER_MODEL", "small")
_model = None


def available() -> bool:
    return importlib.util.find_spec("whisper") is not None


def transcribe(path: str, language: str | None = None) -> list[dict]:
    """Devuelve los segmentos de Whisper con tiempos por palabra."""
    global _model
    import torch
    import whisper
    if _model is None:
        _model = whisper.load_model(MODEL, device="cuda" if torch.cuda.is_available() else "cpu")
    res = _model.transcribe(path, word_timestamps=True, language=language, fp16=torch.cuda.is_available(),
                            # Evita que repita frases cuando hay silencios largos (instrumentales).
                            condition_on_previous_text=False)
    return [{"start": s["start"], "end": s["end"], "words": s.get("words", [])} for s in res.get("segments", [])]
