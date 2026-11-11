from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.application import stems_service as svc

router = APIRouter(prefix="/api/stems", tags=["pistas"])
MAX_BYTES = 200 * 1024 * 1024


class Correction(BaseModel):
    symbol: str | None = None
    notes: list[int] | None = None


def _wrap(fn, *a):
    try:
        return fn(*a)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


@router.get("/capabilities")
def capabilities():
    return svc.capabilities()


class LyricsIn(BaseModel):
    text: str


class ShiftIn(BaseModel):
    seconds: float


class ValidateIn(BaseModel):
    validated: bool


@router.get("/instruments/capabilities")
def instrument_capabilities():
    return svc.instrument_capabilities()


@router.get("/lyrics/capabilities")
def lyrics_capabilities():
    return svc.lyrics_capabilities()


@router.get("")
def list_jobs():
    return svc.list_jobs()


@router.post("")
async def upload(file: UploadFile = File(...), model: str = Form("htdemucs_6s"), separate: bool = Form(True)):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Archivo demasiado grande (máx. 200 MB)")
    return svc.create(file.filename or "cancion.mp3", data, model, separate)


class UrlIn(BaseModel):
    url: str
    model: str = "htdemucs_6s"
    separate: bool = True


@router.post("/from-url")
def from_url(body: UrlIn):
    """Importa el audio de un vídeo de YouTube para estudiarlo (se guarda solo en local)."""
    return _wrap(svc.create_from_url, body.url, body.model, body.separate)


@router.get("/{job_id}")
def get_job(job_id: str):
    return _wrap(svc.load, job_id)


@router.get("/{job_id}/audio/{stem_id}")
def audio(job_id: str, stem_id: str):
    return FileResponse(_wrap(svc.stem_path, job_id, stem_id))


@router.get("/{job_id}/multitrack")
def multitrack(job_id: str):
    """Todas las pistas en un único audio multicanal (se reproduce con un solo reloj)."""
    return FileResponse(_wrap(svc.multitrack_path, job_id), media_type="audio/ogg")


@router.post("/{job_id}/retry")
def retry(job_id: str):
    return _wrap(svc.retry, job_id)


@router.put("/{job_id}/segments/{index}")
def correct(job_id: str, index: int, body: Correction):
    return _wrap(svc.correct_segment, job_id, index, body.symbol, body.notes)


@router.get("/{job_id}/progression")
def progression(job_id: str):
    return {"text": _wrap(svc.progression_text, job_id)}


@router.delete("/{job_id}")
def delete(job_id: str):
    _wrap(svc.delete, job_id)
    return {"ok": True}


@router.post("/{job_id}/lyrics/transcribe")
def transcribe(job_id: str, language: str | None = None):
    return _wrap(svc.transcribe_lyrics, job_id, language)


@router.put("/{job_id}/lyrics")
def set_lyrics(job_id: str, body: LyricsIn):
    return _wrap(svc.set_lyrics, job_id, body.text)


@router.post("/{job_id}/lyrics/lines/{index}/shift")
def shift(job_id: str, index: int, body: ShiftIn):
    return _wrap(svc.shift_line, job_id, index, body.seconds)


@router.get("/{job_id}/sheet")
def sheet(job_id: str):
    return _wrap(svc.sheet, job_id)


@router.put("/{job_id}/validated")
def validated(job_id: str, body: ValidateIn):
    return _wrap(svc.set_validated, job_id, body.validated)


@router.get("/{job_id}/arrangement")
def arrangement(job_id: str, style: str = "basico"):
    return _wrap(svc.arrangement, job_id, style)


@router.post("/{job_id}/instruments")
def instruments(job_id: str):
    return _wrap(svc.detect_instruments, job_id)


@router.get("/{job_id}/guitar-arrangement")
def guitar_arrangement(job_id: str, capo: int | None = None):
    return _wrap(svc.guitar_arrangement, job_id, capo)
