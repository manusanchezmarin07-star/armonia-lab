from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.domain import flamenco

router = APIRouter(prefix="/api/flamenco", tags=["flamenco"])


@router.get("")
def catalog():
    """Técnicas de rasgueo, tonos (por arriba, por medio…) y palos disponibles."""
    return flamenco.catalog()


@router.get("/compas")
def compas(palo: str, tono: str = "arriba", style: str = "basico", capo: int = Query(0, ge=0, le=7)):
    """Un ciclo del palo con rasgueo, acordes de la cadencia andaluza y sus posiciones."""
    try:
        return flamenco.compas(palo, tono, style, capo)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
