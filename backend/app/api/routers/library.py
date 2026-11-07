from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import DATA_DIR
from app.infrastructure.json_store import JsonCollection

router = APIRouter(prefix="/api/library", tags=["biblioteca"])
store = JsonCollection(DATA_DIR / "library.json")


class Entry(BaseModel):
    title: str
    artist: str = ""
    key: str | None = None
    progression: str
    notes: str = ""
    source: str = ""  # de dónde sale la transcripción (oído propio, pistas separadas...)


@router.get("")
def list_entries():
    return store.all()


@router.post("")
def add_entry(e: Entry):
    return store.add(e.model_dump())


@router.put("/{entry_id}")
def update_entry(entry_id: str, e: Entry):
    r = store.update(entry_id, e.model_dump())
    if not r:
        raise HTTPException(404, "No existe")
    return r


@router.delete("/{entry_id}")
def delete_entry(entry_id: str):
    if not store.delete(entry_id):
        raise HTTPException(404, "No existe")
    return {"ok": True}
