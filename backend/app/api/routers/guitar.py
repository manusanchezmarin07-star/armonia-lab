from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.domain import guitar
from app.domain.chords import parse_symbol
from app.domain.scales import SCALES_BY_ID, scale_info

router = APIRouter(prefix="/api/guitar", tags=["guitarra"])


def _safe(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except (ValueError, KeyError) as e:
        raise HTTPException(422, str(e)) from e


@router.get("/chord")
def chord(symbol: str, capo: int = Query(0, ge=0, le=12), limit: int = Query(8, ge=1, le=20)):
    """Posiciones de un acorde en el mástil con digitación."""
    return _safe(guitar.chord_shapes, symbol, capo=capo, limit=limit)


@router.get("/scale")
def scale(scale_id: str, tonic: str = "C", frets: int = Query(15, ge=5, le=19)):
    """Casillas del mástil de una escala (para dibujarla)."""
    def run():
        if scale_id not in SCALES_BY_ID:
            raise ValueError(f"Escala desconocida: {scale_id}")
        info = scale_info(tonic, scale_id)
        return {"pcs": info["pcs"], "notes": info["notes"], "cells": guitar.fretboard(info["pcs"], info["pcs"][0], frets)}
    return _safe(run)


@router.get("/chord-tones")
def chord_tones(symbol: str, frets: int = Query(15, ge=5, le=19)):
    """Todas las notas de un acorde en el mástil (para ver sus formas en cualquier zona)."""
    def run():
        p = parse_symbol(symbol)
        return {"symbol": p.symbol, "cells": guitar.fretboard(p.pcs, p.root.pc, frets)}
    return _safe(run)


class ChordsIn(BaseModel):
    chords: list[str] = Field(..., max_length=400)


@router.post("/capo")
def capo(body: ChordsIn):
    """Cejillas recomendadas para tocar una lista de acordes con formas fáciles."""
    return _safe(guitar.suggest_capo, body.chords)


class NotesIn(BaseModel):
    notes: list[int] = Field(..., max_length=24)


@router.post("/voicing")
def voicing(body: NotesIn):
    """Posición de guitarra natural para un grupo de notas (un voicing pensado para piano)."""
    return {"shape": _safe(guitar.voicing_for_notes, body.notes)}
