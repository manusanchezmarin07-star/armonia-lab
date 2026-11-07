"""Almacenamiento local en JSON (biblioteca personal de progresiones).

Se elige JSON en disco y no una base de datos porque es una app personal de un
solo usuario: así los datos son legibles, se pueden copiar a otro disco y
versionar sin herramientas extra.
"""
from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path


class JsonCollection:
    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.Lock()

    def _read(self) -> list[dict]:
        if not self.path.exists():
            return []
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _write(self, items: list[dict]) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        # Escritura atómica: si se corta la luz a mitad no se corrompe el fichero.
        tmp.replace(self.path)

    def all(self) -> list[dict]:
        with self._lock:
            return self._read()

    def add(self, item: dict) -> dict:
        with self._lock:
            items = self._read()
            item = {**item, "id": uuid.uuid4().hex[:12]}
            items.append(item)
            self._write(items)
            return item

    def update(self, item_id: str, data: dict) -> dict | None:
        with self._lock:
            items = self._read()
            for i, it in enumerate(items):
                if it["id"] == item_id:
                    items[i] = {**it, **data, "id": item_id}
                    self._write(items)
                    return items[i]
            return None

    def delete(self, item_id: str) -> bool:
        with self._lock:
            items = self._read()
            new = [i for i in items if i["id"] != item_id]
            self._write(new)
            return len(new) != len(items)
