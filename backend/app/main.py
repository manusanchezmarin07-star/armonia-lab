"""Punto de entrada: API REST + la web compilada servida desde el mismo proceso,
para que el usuario solo tenga que arrancar una cosa."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routers import library, theory
from app.config import FRONTEND_DIST

app = FastAPI(title="Armonía Lab", version="0.1.0")
# CORS abierto solo para el servidor de desarrollo de Vite (localhost:5173).
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(theory.router)
app.include_router(library.router)

try:  # routers opcionales del sprint 2 (dependencias pesadas)
    from app.api.routers import extra  # noqa: F401
    extra.register(app)
except ImportError:
    pass


@app.get("/api/health")
def health():
    return {"ok": True}


if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        # SPA: cualquier ruta que no sea de la API devuelve index.html.
        f = FRONTEND_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(FRONTEND_DIST / "index.html")
