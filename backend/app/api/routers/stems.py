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


@router.get("")
def list_jobs():
    return svc.list_jobs()


@router.post("")
async def upload(file: UploadFile = File(...), model: str = Form("htdemucs_6s"), separate: bool = Form(True)):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Archivo demasiado grande (máx. 200 MB)")
    return svc.create(file.filename or "cancion.mp3", data, model, separate)


@router.get("/{job_id}")
def get_job(job_id: str):
    return _wrap(svc.load, job_id)


@router.get("/{job_id}/audio/{stem_id}")
def audio(job_id: str, stem_id: str):
    return FileResponse(_wrap(svc.stem_path, job_id, stem_id))


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
