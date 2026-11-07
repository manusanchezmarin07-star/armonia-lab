from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.domain import reharm

router = APIRouter(prefix="/api/reharm", tags=["rearmonización"])


class SubIn(BaseModel):
    chord: str
    key: str
    next_chord: str | None = None
    melody: str | None = None


class MelodyIn(BaseModel):
    note: str
    key: str


class ProgIn(BaseModel):
    text: str
    key: str
    style: str = "jazz"


def _safe(fn, *a):
    try:
        return fn(*a)
    except (ValueError, KeyError) as e:
        raise HTTPException(422, str(e)) from e


@router.post("/substitutes")
def substitutes(b: SubIn):
    return _safe(reharm.substitutes, b.chord, b.key, b.next_chord or None, b.melody or None)


@router.post("/melody")
def melody(b: MelodyIn):
    return _safe(reharm.chords_for_melody, b.note, b.key)


@router.post("/progression")
def progression(b: ProgIn):
    return _safe(reharm.reharmonize, b.text, b.key, b.style)


@router.get("/styles")
def styles():
    return reharm.STYLES
