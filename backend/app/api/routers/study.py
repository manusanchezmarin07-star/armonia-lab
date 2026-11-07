from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.application import study_service as svc

router = APIRouter(prefix="/api/bach", tags=["estudio"])


@router.get("/chorales")
def chorales():
    return svc.chorales()


@router.get("/chorales/{chorale_id}")
def chorale(chorale_id: str):
    try:
        return svc.chorale(chorale_id)
    except (ValueError, OSError) as e:
        raise HTTPException(404, str(e)) from e
