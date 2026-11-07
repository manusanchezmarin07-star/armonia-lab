"""Separación de pistas con Demucs (Meta, licencia MIT).

Se invoca por línea de comandos (`python -m demucs`) en un subproceso: así la
memoria de la GPU se libera al terminar cada canción y un fallo del modelo no
tumba el servidor.
"""
from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

MODELS = {
    "htdemucs_6s": "6 pistas: voz, batería, bajo, guitarra, piano y otros",
    "htdemucs": "4 pistas: voz, batería, bajo y otros (más limpio)",
}


def demucs_available() -> bool:
    return importlib.util.find_spec("demucs") is not None


def gpu_info() -> str:
    try:
        import torch
        return torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    except Exception:
        return "CPU"


def separate(audio: Path, out_dir: Path, model: str = "htdemucs_6s") -> dict[str, Path]:
    """Separa `audio` y devuelve {nombre_pista: ruta_mp3}."""
    if model not in MODELS:
        raise ValueError(f"Modelo desconocido: {model}")
    cmd = [sys.executable, "-m", "demucs", "-n", model, "--mp3", "--mp3-bitrate", "256",
           # --segment bajo para que quepa en 8 GB de VRAM con el modelo de 6 pistas.
           "--segment", "7", "-o", str(out_dir), str(audio)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError("Demucs falló: " + (proc.stderr or proc.stdout)[-800:])
    folder = out_dir / model / audio.stem
    return {p.stem: p for p in sorted(folder.glob("*.mp3"))}
