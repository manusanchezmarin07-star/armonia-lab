"""Descarga del audio de un vídeo de YouTube con yt-dlp (software libre, se ejecuta en local).

Es para estudio personal: el audio se guarda solo en el disco del usuario, igual
que una canción subida a mano, y la app no lo redistribuye. Descargar de YouTube
va contra sus condiciones de uso salvo con los botones que la propia plataforma
ofrece; el usuario es quien decide qué enlaces importa.

Se limita a YouTube a propósito: aceptar cualquier URL convertiría la app en un
descargador genérico y permitiría pedirle que lea direcciones de la red local.
"""
from __future__ import annotations

import importlib.util
import shutil
from collections.abc import Callable
from pathlib import Path
from urllib.parse import urlparse

HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}
MAX_MINUTES = 20


def available() -> bool:
    return importlib.util.find_spec("yt_dlp") is not None


def check_url(url: str) -> str:
    """Valida que sea un enlace de YouTube a un vídeo y lo devuelve limpio."""
    url = url.strip()
    parsed = urlparse(url if "://" in url else "https://" + url)
    if parsed.scheme not in ("http", "https") or (parsed.hostname or "").lower() not in HOSTS:
        raise ValueError("Pega un enlace de YouTube (youtube.com/watch?v=… o youtu.be/…)")
    if parsed.hostname != "youtu.be" and "v=" not in parsed.query and "/shorts/" not in parsed.path and "/live/" not in parsed.path:
        raise ValueError("Ese enlace no es de un vídeo concreto (¿es una lista o un canal?)")
    return parsed.geturl()


def _options(folder: Path, on_progress: Callable[[float], None] | None) -> dict:
    def hook(d: dict) -> None:
        if on_progress and d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            if total:
                on_progress(min(1.0, d.get("downloaded_bytes", 0) / total))

    def too_long(info: dict, *, incomplete: bool = False) -> str | None:
        if info.get("is_live"):
            return "Es una emisión en directo: no se puede analizar"
        if (info.get("duration") or 0) > MAX_MINUTES * 60:
            return f"El vídeo dura más de {MAX_MINUTES} minutos"
        return None

    opts = {
        # m4a primero: es el audio original de YouTube sin recodificar.
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": str(folder / "original.%(ext)s"),
        "noplaylist": True, "quiet": True, "no_warnings": True, "noprogress": True,
        "socket_timeout": 30, "retries": 3, "fragment_retries": 3,
        "match_filter": too_long, "progress_hooks": [hook],
        # YouTube exige ejecutar JavaScript para descifrar los enlaces: yt-dlp usa Deno
        # por defecto; aquí se le permite también Node, que la app ya instala.
        "js_runtimes": {"deno": {}, "node": {}},
    }
    if shutil.which("ffmpeg"):
        opts["ffmpeg_location"] = shutil.which("ffmpeg")
    return opts


def fetch(url: str, folder: Path, on_progress: Callable[[float], None] | None = None) -> tuple[Path, dict]:
    """Descarga el audio en `folder` y devuelve (fichero, {title, uploader, duration, url})."""
    import yt_dlp
    url = check_url(url)
    try:
        with yt_dlp.YoutubeDL(_options(folder, on_progress)) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        msg = str(e).replace("ERROR: ", "")
        raise RuntimeError(
            f"No se pudo descargar el vídeo: {msg[:300]}. YouTube cambia a menudo; si le pasa a todos los vídeos, "
            "actualiza yt-dlp (ACTUALIZAR-YOUTUBE.bat) y vuelve a intentarlo.") from e
    if info is None:  # lo rechazó el filtro (directo o demasiado largo)
        raise ValueError(f"No se puede importar: es un directo o dura más de {MAX_MINUTES} minutos")
    files = sorted(p for p in folder.glob("original.*") if p.suffix not in (".part", ".ytdl"))
    if not files:
        raise RuntimeError("La descarga terminó sin audio")
    return files[0], {"title": info.get("title") or "Vídeo de YouTube", "uploader": info.get("uploader") or "",
                      "duration": info.get("duration"), "url": info.get("webpage_url") or url}
