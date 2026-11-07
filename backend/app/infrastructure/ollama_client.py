"""Cliente mínimo de Ollama (API HTTP local en el puerto 11434)."""
from __future__ import annotations

import re

import httpx

from app.config import OLLAMA_MODEL, OLLAMA_URL


class OllamaClient:
    def __init__(self, url: str = OLLAMA_URL, model: str = OLLAMA_MODEL, timeout: float = 120.0):
        self.url = url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def status(self) -> dict:
        try:
            r = httpx.get(f"{self.url}/api/tags", timeout=2.0)
            r.raise_for_status()
            models = [m["name"] for m in r.json().get("models", [])]
            return {"available": True, "models": models, "model": self.model,
                    "model_ready": any(m == self.model or m.split(":")[0] == self.model.split(":")[0] for m in models)}
        except Exception:
            return {"available": False, "models": [], "model": self.model, "model_ready": False}

    def chat(self, messages: list[dict], temperature: float = 0.2, max_tokens: int = 900) -> str:
        r = httpx.post(f"{self.url}/api/chat", timeout=self.timeout, json={
            "model": self.model, "messages": messages, "stream": False,
            # Temperatura baja: queremos explicaciones fieles al contexto, no creatividad.
            "options": {"temperature": temperature, "num_ctx": 8192, "num_predict": max_tokens},
        })
        r.raise_for_status()
        text = r.json()["message"]["content"]
        # Modelos "razonadores" (qwen3, deepseek-r1) devuelven su borrador entre
        # <think>...</think>; el usuario solo debe ver la respuesta final.
        return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
