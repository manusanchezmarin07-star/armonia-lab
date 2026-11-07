"""Configuración leída de variables de entorno (con valores por defecto para uso local)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("ARMONIA_DATA_DIR", ROOT / "data"))
KNOWLEDGE_DIR = Path(os.environ.get("ARMONIA_KNOWLEDGE_DIR", ROOT / "backend" / "knowledge"))
FRONTEND_DIST = ROOT / "frontend" / "dist"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")

DATA_DIR.mkdir(parents=True, exist_ok=True)
