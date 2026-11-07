"""Trabajos de separación + análisis de canciones, guardados en data/stems/<id>/."""
from __future__ import annotations

import json
import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from app.config import DATA_DIR
from app.domain.analysis import analyze_progression
from app.domain.chords import identify, parse_symbol
from app.infrastructure import separation

ROOT = DATA_DIR / "stems"
ROOT.mkdir(parents=True, exist_ok=True)
# Un solo trabajo a la vez: la GPU de 8 GB no da para dos separaciones simultáneas.
_pool = ThreadPoolExecutor(max_workers=1)
_lock = threading.Lock()
HARMONIC_EXCLUDE = {"drums", "vocals"}
STEM_NAMES = {"vocals": "Voz", "drums": "Batería", "bass": "Bajo", "guitar": "Guitarra", "piano": "Piano",
              "other": "Otros", "mezcla": "Mezcla original"}


def _meta_path(job_id: str) -> Path:
    return ROOT / job_id / "meta.json"


def load(job_id: str) -> dict:
    p = _meta_path(job_id)
    if not job_id.isalnum() or not p.exists():  # isalnum primero: evita rutas tipo "../"
        raise KeyError("No existe ese trabajo")
    return json.loads(p.read_text(encoding="utf-8"))


def _save(meta: dict) -> None:
    with _lock:
        p = _meta_path(meta["id"])
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(p)


def _update(job_id: str, **kw) -> dict:
    meta = load(job_id)
    meta.update(kw)
    _save(meta)
    return meta


def create(filename: str, data: bytes, model: str, separate: bool = True) -> dict:
    job_id = uuid.uuid4().hex[:12]
    folder = ROOT / job_id
    folder.mkdir(parents=True)
    ext = Path(filename).suffix.lower() or ".mp3"
    src = folder / f"original{ext}"
    src.write_bytes(data)
    do_sep = separate and separation.demucs_available()
    meta = {"id": job_id, "title": Path(filename).stem, "filename": filename, "status": "en cola", "progress": 0.0,
            "message": "", "model": model if do_sep else None, "separated": False, "stems": [], "analysis": None,
            "device": separation.gpu_info() if do_sep else None}
    _save(meta)
    _pool.submit(_run, job_id, src, model, do_sep)
    return meta


def _run(job_id: str, src: Path, model: str, do_sep: bool) -> None:
    from app.infrastructure import audio_analysis
    try:
        stems: dict[str, Path] = {}
        if do_sep:
            _update(job_id, status="separando pistas", progress=0.1,
                    message="Demucs está separando los instrumentos (con GPU tarda ~1 min por canción).")
            stems = separation.separate(src, ROOT / job_id / "sep", model)
        _update(job_id, status="analizando acordes", progress=0.7, message="Detectando pulso, tonalidad y acordes…")
        harmonic = [str(p) for n, p in stems.items() if n not in HARMONIC_EXCLUDE] or [str(src)]
        bass = str(stems["bass"]) if "bass" in stems else None
        analysis = audio_analysis.analyze(harmonic, bass)
        _attach_roman(analysis)
        stem_list = [{"id": n, "name": STEM_NAMES.get(n, n), "file": str(p.relative_to(ROOT / job_id))} for n, p in stems.items()]
        stem_list.append({"id": "mezcla", "name": STEM_NAMES["mezcla"], "file": src.name})
        _update(job_id, status="listo", progress=1.0, message="", separated=bool(stems), stems=stem_list, analysis=analysis)
    except Exception as e:  # se guarda el error para mostrarlo en la interfaz
        _update(job_id, status="error", message=str(e)[:1000])


def _attach_roman(analysis: dict) -> None:
    """Añade grados romanos a los segmentos usando el analizador de progresiones."""
    segs = [s for s in analysis["segments"] if s["symbol"] != "N"]
    if not segs:
        return
    try:
        res = analyze_progression(" ".join(s["symbol"] for s in segs), analysis.get("key"))
    except ValueError:
        return
    for s, c in zip(segs, res["chords"]):
        s["roman"] = c["analysis"]["roman"]
        s["function"] = c["analysis"]["function"]
        s["kind"] = c["analysis"]["kind"]


def list_jobs() -> list[dict]:
    out = []
    for p in sorted(ROOT.glob("*/meta.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        m = json.loads(p.read_text(encoding="utf-8"))
        out.append({k: m[k] for k in ("id", "title", "status", "separated")})
    return out


def stem_path(job_id: str, stem_id: str) -> Path:
    meta = load(job_id)
    for s in meta["stems"]:
        if s["id"] == stem_id:
            return ROOT / job_id / s["file"]
    raise KeyError("Pista no encontrada")


def correct_segment(job_id: str, index: int, symbol: str | None, notes: list[int] | None) -> dict:
    """Corrige un acorde detectado, escribiéndolo o tocándolo en el MIDI."""
    meta = load(job_id)
    segs = meta["analysis"]["segments"]
    if not 0 <= index < len(segs):
        raise KeyError("Segmento fuera de rango")
    if notes:
        readings = identify(notes)
        if not readings:
            raise ValueError("Con esas notas no se forma un acorde reconocible")
        symbol = readings[0].symbol
        pcs = readings[0].pcs
    elif symbol:
        if symbol == "N":
            pcs = []
        else:
            p = parse_symbol(symbol)
            symbol, pcs = p.symbol, p.pcs
    else:
        raise ValueError("Indica un acorde o unas notas")
    segs[index].update(symbol=symbol, pcs=pcs, edited=True, confidence=1.0)
    _attach_roman(meta["analysis"])
    _save(meta)
    return meta


def delete(job_id: str) -> None:
    load(job_id)
    shutil.rmtree(ROOT / job_id)


def progression_text(job_id: str) -> str:
    """Progresión compacta (sin repetir acordes consecutivos) para la biblioteca."""
    meta = load(job_id)
    out: list[str] = []
    for s in meta["analysis"]["segments"]:
        if s["symbol"] != "N" and (not out or out[-1] != s["symbol"]):
            out.append(s["symbol"])
    return " ".join(out)


def capabilities() -> dict:
    return {"demucs": separation.demucs_available(), "models": separation.MODELS,
            "device": separation.gpu_info() if separation.demucs_available() else None}
