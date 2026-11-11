"""Separación de pistas con Demucs (Meta, licencia MIT).

Se lanza en un subproceso (`demucs_worker`): la memoria de la GPU se libera al
terminar cada canción, un fallo del modelo no tumba el servidor y, si se cuelga,
se puede matar al pasar el límite de tiempo.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
import threading
from collections.abc import Callable
from pathlib import Path

MODELS = {
    "htdemucs_6s": "6 pistas: voz, batería, bajo, guitarra, piano y otros",
    "htdemucs": "4 pistas: voz, batería, bajo y otros (más limpio)",
}
BACKEND_DIR = Path(__file__).resolve().parents[2]
# Límite generoso: en CPU una canción de 5 min ronda los 10 min; en GPU, 1 min.
TIMEOUT_S = int(os.environ.get("DEMUCS_TIMEOUT", "3600"))
_PCT = re.compile(r"(\d{1,3})%\|")


def demucs_available() -> bool:
    return importlib.util.find_spec("demucs") is not None


def gpu_info() -> str:
    try:
        import torch
        return torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    except Exception:
        return "CPU"


def run_worker(module: str, args: list[str], timeout: float, on_progress: Callable[[float], None] | None = None,
               env: dict[str, str] | None = None) -> dict:
    """Ejecuta un módulo de `app.infrastructure` en un proceso hijo y devuelve su JSON.

    Lee stderr mientras corre para sacar el porcentaje de la barra de progreso y
    mata el proceso si supera `timeout` segundos.
    """
    full_env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", **(env or {})}
    proc = subprocess.Popen([sys.executable, "-m", module, *args], cwd=str(BACKEND_DIR), env=full_env,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    err_tail: list[str] = []

    def read_err() -> None:
        assert proc.stderr is not None
        # tqdm reescribe la línea con \r: se lee a trozos, no por líneas.
        while chunk := proc.stderr.read1(4096):  # type: ignore[attr-defined]
            text = chunk.decode("utf-8", errors="replace")
            err_tail.append(text)
            del err_tail[:-40]
            if on_progress and (m := _PCT.findall(text)):
                on_progress(min(100, int(m[-1])) / 100)

    reader = threading.Thread(target=read_err, daemon=True)
    reader.start()
    try:
        out, _ = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.communicate()
        raise RuntimeError(f"Se ha superado el límite de {int(timeout // 60)} min y se ha cancelado.") from None
    reader.join(timeout=2)
    if proc.returncode != 0:
        tail = "".join(err_tail)
        # De la traza de Python interesa la última línea (el error en sí), sin las barras de progreso.
        lines = [ln.strip() for ln in tail.replace("\r", "\n").splitlines() if ln.strip() and "%|" not in ln]
        raise RuntimeError(lines[-1][:500] if lines else f"El proceso terminó con código {proc.returncode}")
    last = out.decode("utf-8", errors="replace").strip().splitlines()
    return json.loads(last[-1]) if last else {}


def separate(audio: Path, out_dir: Path, model: str = "htdemucs_6s",
             on_progress: Callable[[float], None] | None = None) -> dict[str, Path]:
    """Separa `audio` y devuelve {nombre_pista: ruta_mp3}."""
    if model not in MODELS:
        raise ValueError(f"Modelo desconocido: {model}")
    folder = out_dir / model / "original"
    res = run_worker("app.infrastructure.demucs_worker", [str(audio), str(folder), model], TIMEOUT_S, on_progress)
    return {name: Path(p) for name, p in sorted(res.get("stems", {}).items())}
