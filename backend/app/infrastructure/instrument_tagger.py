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
    if os.environ.get("ARMONIA_TAGGER") == "off":  # tests y equipos donde no se quiera descargar el modelo
        return False
    return all(importlib.util.find_spec(m) is not None for m in ("transformers", "torch"))


def _load():
    """Modelo y extractor de características (se cargan una vez por proceso)."""
    global _pipe
    if _pipe is None:
        import torch
        from transformers import ASTFeatureExtractor, ASTForAudioClassification
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = ASTForAudioClassification.from_pretrained(MODEL).to(device).eval()
        _pipe = (ASTFeatureExtractor.from_pretrained(MODEL), model, device)
    return _pipe


def tag_windows(path: str) -> list[dict]:
    """Devuelve [{start, end, scores:{etiqueta AudioSet: probabilidad}}] para ventanas de la pista."""
    import librosa
    import torch
    y, _ = librosa.load(path, sr=SR, mono=True)
    dur = len(y) / SR
    n = max(1, min(MAX_WINDOWS, int(dur // WINDOW)))
    starts = np.linspace(0, max(0.0, dur - WINDOW), n)
    extractor, model, device = _load()
    labels = model.config.id2label
    out = []
    for st in starts:
        seg = y[int(st * SR):int((st + WINDOW) * SR)]
        if len(seg) < SR or np.sqrt(np.mean(seg ** 2)) < 1e-3:  # silencio: nada que clasificar
            continue
        inputs = extractor(seg, sampling_rate=SR, return_tensors="pt").to(device)
        with torch.no_grad():
            # AudioSet es multietiqueta (pueden sonar piano Y voz a la vez): sigmoide por clase.
            # Con softmax, que es lo que aplica el «pipeline» genérico, la clase «Music» se lleva
            # casi toda la probabilidad y ningún instrumento pasa del 2 %.
            probs = torch.sigmoid(model(**inputs).logits[0]).cpu().numpy()
        top = np.argsort(probs)[::-1][:25]
        out.append({"start": float(st), "end": float(min(dur, st + WINDOW)),
                    "scores": {labels[int(i)]: float(probs[i]) for i in top}})
    return out


def tag_many(paths: list[str], timeout: float = 900.0) -> dict[str, list[dict]]:
    """Etiqueta varias pistas en un proceso hijo con límite de tiempo.

    La primera vez hay que descargar el modelo y esa descarga puede quedarse
    colgada (red lenta, cortafuegos): en un hilo del servidor no habría forma de
    cancelarla y bloquearía la cola de canciones. En un proceso aparte se mata y
    listo. Con ARMONIA_TAGGER_INPROCESS=1 (tests) se ejecuta en el propio proceso.
    """
    if os.environ.get("ARMONIA_TAGGER_INPROCESS") == "1":
        return {p: tag_windows(p) for p in paths}
    from app.infrastructure.separation import run_worker
    # Tiempos de espera de Hugging Face: sin ellos una conexión muerta espera para siempre.
    # HF_HUB_DISABLE_XET: la descarga HTTP clásica en vez del protocolo Xet, que tras algunos
    # cortafuegos reintenta en silencio sin acabar nunca.
    env = {"HF_HUB_DOWNLOAD_TIMEOUT": "60", "HF_HUB_ETAG_TIMEOUT": "20", "HF_HUB_DISABLE_XET": "1"}
    return run_worker("app.infrastructure.instrument_tagger", paths, timeout, env=env)


if __name__ == "__main__":  # proceso hijo: rutas como argumentos, JSON por stdout
    import json
    import sys
    print(json.dumps({p: tag_windows(p) for p in sys.argv[1:]}), flush=True)
