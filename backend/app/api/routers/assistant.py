from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.application import assistant_service as svc

router = APIRouter(prefix="/api/assistant", tags=["asistente"])


class Msg(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)


class ChatIn(BaseModel):
    messages: list[Msg] = Field(..., min_length=1, max_length=40)


@router.get("/status")
def status():
    return svc.status()


@router.post("/chat")
def chat(body: ChatIn):
    try:
        return svc.answer([m.model_dump() for m in body.messages])
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
