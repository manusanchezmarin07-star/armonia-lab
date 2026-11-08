from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.application import theory_service as svc
from app.domain.transpose import transpose as transpose_progression

router = APIRouter(prefix="/api", tags=["teoría"])


class NotesIn(BaseModel):
    notes: list[int] = Field(..., min_length=1, max_length=20)
    key: str | None = None


class TransitionIn(BaseModel):
    from_chord: str
    to_chord: str


class ModulationIn(BaseModel):
    from_key: str
    to_key: str


class ProgressionIn(BaseModel):
    text: str
    key: str | None = None


def _safe(fn, *args):
    # Los errores de dominio (cifrado mal escrito, nota inexistente) se devuelven
    # como 422 con un mensaje legible en lugar de un 500 genérico.
    try:
        return fn(*args)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/chords/identify")
def identify(body: NotesIn):
    return _safe(svc.identify_notes, body.notes, body.key)


@router.get("/chords/parse")
def parse(symbol: str, key: str | None = None):
    return _safe(svc.parse_chord, symbol, key)


@router.post("/chords/transition")
def transition(body: TransitionIn):
    return _safe(svc.transition, body.from_chord, body.to_chord)


@router.get("/keys/{key}/diatonic")
def diatonic(key: str):
    return _safe(svc.diatonic, key)


@router.post("/modulation")
def modulation(body: ModulationIn):
    return _safe(svc.modulate, body.from_key, body.to_key)


@router.get("/scales")
def scales():
    return svc.scale_catalog()


@router.get("/scales/{scale_id}")
def scale(scale_id: str, tonic: str = "C"):
    return _safe(svc.scale, scale_id, tonic)


@router.post("/progression/analyze")
def analyze(body: ProgressionIn):
    return _safe(svc.analyze, body.text, body.key)


@router.post("/progression/negative")
def negative(body: ProgressionIn):
    if not body.key:
        raise HTTPException(422, "La armonía negativa necesita una tonalidad (eje)")
    return _safe(svc.negative, body.text, body.key)


@router.get("/rhythm")
def rhythm():
    return svc.rhythm_catalog()


class TransposeIn(BaseModel):
    text: str
    semitones: int | None = None
    from_key: str | None = None
    to_key: str | None = None


@router.post("/progression/transpose")
def transpose(body: TransposeIn):
    return _safe(transpose_progression, body.text, body.semitones, body.from_key or None, body.to_key or None)


@router.get("/chords/scales")
def chord_scales(symbol: str):
    from app.domain.chords import parse_symbol
    from app.domain.scales import scales_for_chord

    def run():
        p = parse_symbol(symbol)
        return {"symbol": p.symbol, "scales": scales_for_chord(p.root.pc, p.pcs, p.root.name)}
    return _safe(run)


@router.get("/chords/hands")
def chord_hands(symbol: str, style: str = "basico", inversion: int = 0):
    from app.domain.hands import two_hands
    return _safe(two_hands, symbol, style, inversion)


@router.get("/chords/hand-styles")
def hand_styles():
    from app.domain.hands import INVERSIONS, STYLES
    return {"styles": STYLES, "inversions": INVERSIONS}
