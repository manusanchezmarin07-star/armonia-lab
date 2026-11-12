"""Entrada y salida de audio del modo canción.

Dos ideas para que el proceso no dependa de cómo esté instalado cada PC:

1. Todo lo que entra se convierte a un formato que libsndfile lee por sí solo
   (FLAC), así ni Demucs ni el análisis necesitan ffmpeg más adelante. ffmpeg solo
   hace falta para formatos comprimidos «raros» (m4a, aac, opus, webm, wma…).
2. Las pistas separadas se empaquetan en UN fichero multicanal (dos canales por
   pista). El navegador lo reproduce con un único reloj, de modo que las pistas no
   pueden desincronizarse entre sí.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np

SR = 44100
# Formatos que libsndfile (y el navegador) leen directamente.
NATIVE = {".wav", ".flac", ".mp3", ".ogg", ".aiff", ".aif"}
# Con 1–8 canales Vorbis asume una disposición de altavoces (estéreo, 5.1, 7.1…) y
# acopla canales entre sí: al silenciar una pista se colaría un resto de otra. Con
# más de 8 cada canal se codifica por separado, así que se rellena hasta 10.
MIN_CHANNELS = 10


def ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def normalize(src: Path) -> Path:
    """Devuelve un fichero que el resto del proceso puede leer sin ffmpeg.

    Si el original ya es legible se deja tal cual; si no, se convierte a FLAC
    (sin pérdida) junto al original. Lanza ValueError con un mensaje claro si el
    audio no se puede leer.
    """
    import soundfile as sf
    if src.suffix.lower() in NATIVE:
        try:
            info = sf.info(str(src))
            if info.frames > 0:
                return src
        except Exception:
            pass  # extensión engañosa o fichero dañado: se intenta con ffmpeg
    exe = ffmpeg()
    if exe is None:
        raise ValueError(
            f"No puedo leer «{src.suffix or 'ese formato'}» sin ffmpeg. Instálalo (winget install Gyan.FFmpeg), "
            "reinicia la app y vuelve a intentarlo, o sube la canción en mp3, wav o flac.")
    out = src.with_name("normalizado.flac")
    proc = subprocess.run([exe, "-y", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "2", "-ar", str(SR), str(out)],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0 or not out.exists() or out.stat().st_size < 1000:
        raise ValueError("El archivo no contiene audio que se pueda leer: " + (proc.stderr or "").strip()[-300:])
    return out


def read_stereo(path: Path | str, sr: int = SR) -> np.ndarray:
    """Audio como matriz (muestras, 2) en float32 a `sr` Hz."""
    import soundfile as sf
    y, file_sr = sf.read(str(path), dtype="float32", always_2d=True)
    if y.shape[1] == 1:
        y = np.repeat(y, 2, axis=1)
    elif y.shape[1] > 2:
        y = y[:, :2]
    if file_sr != sr:
        import librosa
        y = librosa.resample(y.T, orig_sr=file_sr, target_sr=sr).T
    return np.ascontiguousarray(y, dtype="float32")


def write_multitrack(stems: list[Path], out: Path) -> dict:
    """Empaqueta las pistas en un Ogg Vorbis multicanal (L y R de cada pista seguidos).

    Devuelve {"channels": n, "duration": s}. Todas las pistas se igualan a la más
    larga (los mp3 pueden diferir en unas pocas muestras).

    Se lee y se escribe a trozos de 5 s: cargar seis pistas enteras de una canción de
    8 minutos ocupaba más de 2 GB de memoria. (Además libsndfile se cae con escrituras
    Vorbis muy grandes de una sola vez.)
    """
    import soundfile as sf
    channels = max(MIN_CHANNELS, 2 * len(stems))
    tmp = out.with_suffix(".tmp.ogg")
    block = SR * 5
    files = [sf.SoundFile(str(p)) for p in stems]
    try:
        if any(f.samplerate != SR for f in files):
            # Pistas a otra frecuencia (canciones separadas con versiones antiguas): hay que
            # remuestrearlas enteras; es el camino lento, pero solo ocurre una vez por canción.
            tracks = [read_stereo(p) for p in stems]
            total = max(len(t) for t in tracks)
            read = lambda k, start: tracks[k][start:start + block]  # noqa: E731
        else:
            total = max(f.frames for f in files)

            def read(k: int, start: int) -> np.ndarray:
                y = files[k].read(block, dtype="float32", always_2d=True)
                return np.repeat(y, 2, axis=1) if y.shape[1] == 1 else y[:, :2]
        with sf.SoundFile(str(tmp), "w", samplerate=SR, channels=channels, format="OGG", subtype="VORBIS") as dst:
            for start in range(0, total, block):
                chunk = np.zeros((min(block, total - start), channels), dtype="float32")
                for k in range(len(stems)):
                    y = read(k, start)
                    chunk[:len(y), 2 * k:2 * k + 2] = y
                np.clip(chunk, -1.0, 1.0, out=chunk)
                dst.write(chunk)
    finally:
        for f in files:
            f.close()
    tmp.replace(out)
    return {"channels": channels, "duration": round(total / SR, 3)}
