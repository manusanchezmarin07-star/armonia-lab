"""Trabajos de separación + análisis de canciones, guardados en data/stems/<id>/."""
from __future__ import annotations

import json
import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from app.config import DATA_DIR
from app.domain.analysis import analyze_progression
from app.domain.chords import identify, parse_symbol
from app.domain.lyrics import align_to_asr, build_sheet, distribute_to_phrases, lines_from_asr
from app.infrastructure import separation

ROOT = DATA_DIR / "stems"
ROOT.mkdir(parents=True, exist_ok=True)
# Un solo trabajo a la vez: la GPU de 8 GB no da para dos separaciones simultáneas.
_pool = ThreadPoolExecutor(max_workers=1)
# Cola aparte para el reconocimiento de instrumentos: es opcional y lento, y no debe
# retrasar (ni bloquear, si se cuelga una descarga) la separación de la canción siguiente.
_aux_pool = ThreadPoolExecutor(max_workers=1)
# RLock: _mutate guarda (y por tanto vuelve a tomar el candado) dentro de su propia sección.
_lock = threading.RLock()
HARMONIC_EXCLUDE = {"drums", "vocals"}
STEM_NAMES = {"vocals": "Voz", "drums": "Batería", "bass": "Bajo", "guitar": "Guitarra", "piano": "Piano",
              "other": "Otros", "mezcla": "Mezcla original"}


def _meta_path(job_id: str) -> Path:
    return ROOT / job_id / "meta.json"


def load(job_id: str) -> dict:
    p = _meta_path(job_id)
    if not job_id.isalnum() or not p.exists():  # isalnum primero: evita rutas tipo "../"
        raise KeyError("No existe ese trabajo")
    return json.loads(p.read_text(encoding="utf-8"))


def _save(meta: dict) -> None:
    with _lock:
        p = _meta_path(meta["id"])
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(p)


def _mutate(job_id: str, fn) -> dict:
    """Leer → modificar → guardar de forma atómica.

    Los trabajos en segundo plano (separación, letra, instrumentos) y las
    ediciones del usuario escriben en el mismo meta.json: sin esto, un trabajo
    que leyó el fichero antes de una corrección la borraba al guardar.
    """
    with _lock:
        meta = load(job_id)
        fn(meta)
        _save(meta)
        return meta


def _update(job_id: str, **kw) -> dict:
    return _mutate(job_id, lambda meta: meta.update(kw))


def create(filename: str, data: bytes, model: str, separate: bool = True, source: dict | None = None) -> dict:
    job_id = uuid.uuid4().hex[:12]
    folder = ROOT / job_id
    folder.mkdir(parents=True)
    ext = Path(filename).suffix.lower() or ".mp3"
    src = folder / f"original{ext}"
    src.write_bytes(data)
    do_sep = separate and separation.demucs_available()
    meta = {"id": job_id, "title": Path(filename).stem, "filename": filename, "status": "en cola", "progress": 0.0,
            "message": "", "model": model if do_sep else None, "separated": False, "stems": [], "analysis": None,
            "device": separation.gpu_info() if do_sep else None, "original": src.name, "want_separation": do_sep}
    if source:
        meta["source"] = source
    _save(meta)
    _pool.submit(_run, job_id)
    return meta


def retry(job_id: str) -> dict:
    """Vuelve a procesar una canción que falló o se quedó a medias (usa el audio ya subido)."""
    meta = load(job_id)
    if meta["status"] not in ("error", "listo"):
        raise ValueError("Esta canción ya se está procesando")
    meta = _update(job_id, status="en cola", progress=0.0, message="", warning=None)
    _pool.submit(_run, job_id)
    return meta


def recover_interrupted() -> int:
    """Al arrancar: las canciones que se quedaron a medias (se cerró la app) pasan a
    «error» con opción de reintentar; si no, se quedarían «en cola» para siempre."""
    n = 0
    for p in ROOT.glob("*/meta.json"):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if m.get("status") not in ("listo", "error"):
            _update(m["id"], status="error", message="El proceso se interrumpió (se cerró la app). Pulsa «Reintentar».")
            n += 1
        elif m.get("instruments_status") == "analizando":
            _update(m["id"], instruments_status="error", instruments_error="Se interrumpió al cerrar la app.")
    return n


def _original(meta: dict) -> Path:
    """Audio subido. Las canciones antiguas no guardaban el nombre: es la pista «mezcla»."""
    folder = ROOT / meta["id"]
    if meta.get("original"):
        return folder / meta["original"]
    mix = next((st["file"] for st in meta.get("stems", []) if st["id"] == "mezcla"), None)
    if mix:
        return folder / mix
    found = sorted(folder.glob("original.*"))
    if not found:
        raise ValueError("No se encuentra el audio original de esta canción")
    return found[0]


def _run(job_id: str) -> None:
    from app.infrastructure import audio_analysis, audio_io
    try:
        meta = load(job_id)
        folder = ROOT / job_id
        src = _original(meta)
        model = meta.get("model") or "htdemucs_6s"
        _update(job_id, status="preparando audio", progress=0.03, message="Leyendo el archivo…")
        audio = audio_io.normalize(src)
        stems: dict[str, Path] = {}
        warning = None
        if meta.get("want_separation", bool(meta.get("model"))) and separation.demucs_available():
            _update(job_id, status="separando pistas", progress=0.05,
                    message="Demucs está separando los instrumentos (con GPU, alrededor de 1 min por canción).")

            def on_progress(p: float) -> None:
                _update(job_id, progress=round(0.05 + 0.6 * p, 3))
            try:
                stems = separation.separate(audio, folder / "sep", model, on_progress)
            except Exception as e:
                # Sin pistas la canción sigue siendo útil: se sacan los acordes de la mezcla.
                warning = f"No se pudieron separar las pistas ({str(e)[:300]}). Los acordes se han sacado de la mezcla completa."
        _update(job_id, status="analizando acordes", progress=0.7, message="Detectando pulso, tonalidad y acordes…")
        harmonic = [str(p) for n, p in stems.items() if n not in HARMONIC_EXCLUDE] or [str(audio)]
        bass = str(stems["bass"]) if "bass" in stems else None
        analysis = audio_analysis.analyze(harmonic, bass)
        _attach_roman(analysis)
        stem_list = [{"id": n, "name": STEM_NAMES.get(n, n), "file": str(p.relative_to(folder))} for n, p in stems.items()]
        # La «mezcla» es lo que suena en el navegador si no hay pistas: mejor el fichero
        # normalizado (FLAC) que un formato que quizá el navegador no sepa reproducir.
        stem_list.append({"id": "mezcla", "name": STEM_NAMES["mezcla"], "file": audio.name})
        _update(job_id, status="preparando el reproductor", progress=0.85, message="Midiendo qué suena en cada pista…",
                separated=bool(stems), stems=stem_list, analysis=analysis, warning=warning)
        _stem_activity(job_id)
        if stems:
            _update(job_id, progress=0.92, message="Empaquetando las pistas para que suenen sincronizadas…")
            _build_multitrack(job_id)
        _update(job_id, status="listo", progress=1.0, message="")
        # El reconocimiento de instrumentos es un extra lento: va después y en otra cola.
        _start_tagging(job_id)
    except Exception as e:  # se guarda el error para mostrarlo en la interfaz
        _update(job_id, status="error", message=str(e)[:1000])


# ---------------------------------------------------------------------------
# Fichero multipista (todas las pistas en un solo audio multicanal)
# ---------------------------------------------------------------------------

_mt_lock = threading.Lock()


def _build_multitrack(job_id: str) -> dict:
    from app.infrastructure import audio_io
    meta = load(job_id)
    folder = ROOT / job_id
    tracks = [st for st in meta["stems"] if st["id"] != "mezcla"]
    if not tracks:
        raise ValueError("Esta canción no tiene pistas separadas")
    info = audio_io.write_multitrack([folder / st["file"] for st in tracks], folder / "multipista.ogg")
    layout = [{"id": st["id"], "channels": [2 * k, 2 * k + 1]} for k, st in enumerate(tracks)]
    return _update(job_id, multitrack={"file": "multipista.ogg", "channels": info["channels"], "layout": layout})


def multitrack_path(job_id: str) -> Path:
    """Ruta del multipista; se crea la primera vez para canciones separadas con versiones antiguas."""
    meta = load(job_id)
    if not meta.get("separated"):
        raise KeyError("Esta canción no tiene pistas separadas")
    with _mt_lock:
        meta = load(job_id)
        path = ROOT / job_id / (meta.get("multitrack") or {}).get("file", "multipista.ogg")
        if not meta.get("multitrack") or not path.exists():
            _build_multitrack(job_id)
            path = ROOT / job_id / "multipista.ogg"
    return path


def _attach_roman(analysis: dict) -> None:
    """Añade grados romanos a los segmentos usando el analizador de progresiones."""
    segs = [s for s in analysis["segments"] if s["symbol"] != "N"]
    if not segs:
        return
    try:
        res = analyze_progression(" ".join(s["symbol"] for s in segs), analysis.get("key"))
    except ValueError:
        return
    for s, c in zip(segs, res["chords"]):
        s["roman"] = c["analysis"]["roman"]
        s["function"] = c["analysis"]["function"]
        s["kind"] = c["analysis"]["kind"]


def list_jobs() -> list[dict]:
    out = []
    for p in sorted(ROOT.glob("*/meta.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        m = json.loads(p.read_text(encoding="utf-8"))
        out.append({k: m[k] for k in ("id", "title", "status", "separated")})
    return out


def stem_path(job_id: str, stem_id: str) -> Path:
    meta = load(job_id)
    for s in meta["stems"]:
        if s["id"] == stem_id:
            return ROOT / job_id / s["file"]
    raise KeyError("Pista no encontrada")


def correct_segment(job_id: str, index: int, symbol: str | None, notes: list[int] | None) -> dict:
    """Corrige un acorde detectado, escribiéndolo o tocándolo en el MIDI."""
    if notes:
        readings = identify(notes)
        if not readings:
            raise ValueError("Con esas notas no se forma un acorde reconocible")
        symbol = readings[0].symbol
        pcs = readings[0].pcs
    elif symbol:
        if symbol == "N":
            pcs = []
        else:
            p = parse_symbol(symbol)
            symbol, pcs = p.symbol, p.pcs
    else:
        raise ValueError("Indica un acorde o unas notas")

    def apply(meta: dict) -> None:
        segs = meta["analysis"]["segments"]
        if not 0 <= index < len(segs):
            raise KeyError("Segmento fuera de rango")
        segs[index].update(symbol=symbol, pcs=pcs, edited=True, confidence=1.0)
        _attach_roman(meta["analysis"])
    return _mutate(job_id, apply)


def delete(job_id: str) -> None:
    load(job_id)
    shutil.rmtree(ROOT / job_id)


def progression_text(job_id: str) -> str:
    """Progresión compacta (sin repetir acordes consecutivos) para la biblioteca."""
    meta = load(job_id)
    out: list[str] = []
    for s in meta["analysis"]["segments"]:
        if s["symbol"] != "N" and (not out or out[-1] != s["symbol"]):
            out.append(s["symbol"])
    return " ".join(out)


def capabilities() -> dict:
    return {"demucs": separation.demucs_available(), "models": separation.MODELS,
            "device": separation.gpu_info() if separation.demucs_available() else None}


# ---------------------------------------------------------------------------
# Letra
# ---------------------------------------------------------------------------

def _vocals_path(meta: dict) -> Path | None:
    for st in meta.get("stems", []):
        if st["id"] == "vocals":
            return ROOT / meta["id"] / st["file"]
    return None


def lyrics_capabilities() -> dict:
    from app.infrastructure import lyrics_asr
    return {"whisper": lyrics_asr.available(), "model": lyrics_asr.MODEL}


def transcribe_lyrics(job_id: str, language: str | None = None) -> dict:
    """Lanza la transcripción automática en segundo plano (usa la pista de voz si existe)."""
    from app.infrastructure import lyrics_asr
    meta = load(job_id)
    if not lyrics_asr.available():
        raise ValueError("Whisper no está instalado: ejecuta INSTALAR.bat con el módulo de pistas")
    src = _vocals_path(meta) or ROOT / job_id / meta["stems"][-1]["file"]
    meta = _update(job_id, lyrics_status="transcribiendo")

    def run():
        try:
            segs = lyrics_asr.transcribe(str(src), language)
            lines = lines_from_asr(segs)
            words = [w for line in lines for w in line["words"]]
            _update(job_id, lyrics_status="listo", asr_words=words,
                    lyrics={"source": "transcripción automática", "lines": lines})
        except Exception as e:
            _update(job_id, lyrics_status="error", lyrics_error=str(e)[:500])
    _pool.submit(run)
    return meta


def set_lyrics(job_id: str, text: str) -> dict:
    """Guarda una letra pegada y le pone tiempos (alineada con la transcripción o con las frases de la voz)."""
    from app.infrastructure import audio_analysis
    meta = load(job_id)
    if meta.get("asr_words"):
        lines, source = align_to_asr(text, meta["asr_words"]), "pegada + alineada con la voz"
    else:
        vocals = _vocals_path(meta)
        phrases = audio_analysis.vocal_phrases(str(vocals)) if vocals else []
        duration = (meta.get("analysis") or {}).get("duration", 0.0)
        lines = distribute_to_phrases(text, phrases, duration)
        source = "pegada + frases de la voz" if phrases else "pegada (reparto aproximado)"
    return _update(job_id, lyrics={"source": source, "lines": lines, "text": text}, validated=False)


def shift_line(job_id: str, index: int, seconds: float) -> dict:
    """Ajuste fino: adelanta o retrasa un verso entero."""
    def apply(meta: dict) -> None:
        lines = (meta.get("lyrics") or {}).get("lines", [])
        if not 0 <= index < len(lines):
            raise KeyError("Verso fuera de rango")
        line = lines[index]
        for w in line["words"]:
            w["start"] = round(max(0.0, w["start"] + seconds), 3)
            w["end"] = round(max(0.0, w["end"] + seconds), 3)
        line["start"], line["end"] = line["words"][0]["start"], line["words"][-1]["end"]
    return _mutate(job_id, apply)


def sheet(job_id: str) -> list[dict]:
    meta = load(job_id)
    lines = (meta.get("lyrics") or {}).get("lines", [])
    analysis = meta.get("analysis") or {}
    return build_sheet(lines, analysis.get("segments", []), analysis.get("duration", 0.0))


def set_validated(job_id: str, value: bool) -> dict:
    return _update(job_id, validated=value)


def arrangement(job_id: str, style: str = "basico") -> list[dict]:
    """Voicing a dos manos (con dedos) para cada acorde de la canción, encadenados sin saltos."""
    from app.domain.hands import STYLES, arrange
    if style not in STYLES:
        raise ValueError(f"Estilo desconocido: {style}")
    segs = (load(job_id).get("analysis") or {}).get("segments", [])
    playable = [s for s in segs if s["symbol"] != "N"]
    voiced = iter(arrange([s["symbol"].split(" ")[0] for s in playable], style))
    out = []
    for i, s in enumerate(segs):
        v = next(voiced) if s["symbol"] != "N" else {}
        out.append({"index": i, "start": s["start"], "end": s["end"], "symbol": s["symbol"],
                    "left": v.get("left", []), "right": v.get("right", []), "spell": v.get("spell", {})})
    return out


# ---------------------------------------------------------------------------
# Instrumentos
# ---------------------------------------------------------------------------

def _stem_activity(job_id: str) -> dict:
    """Marca qué pistas tienen contenido (rápido, sin modelos): las vacías se ocultan en el mezclador."""
    import librosa

    from app.domain.instruments import song_instruments, stem_label
    from app.infrastructure import audio_analysis
    meta = load(job_id)
    folder = ROOT / job_id
    mix = folder / next(st["file"] for st in meta["stems"] if st["id"] == "mezcla")
    y = audio_analysis.load_mono([str(mix)])
    ref = float(librosa.feature.rms(y=y, hop_length=2048)[0].max()) if len(y) else 1.0
    results = {}
    for st in meta["stems"]:
        act = audio_analysis.stem_activity(str(folder / st["file"]), ref_peak=ref)
        active = act["has_content"] or st["id"] == "mezcla"
        results[st["id"]] = {"activity": act, "active": active, "name": stem_label(st["id"], st.get("instruments") or [])}

    def apply(current: dict) -> None:
        for st in current["stems"]:
            st.update(results.get(st["id"], {}))
        # Pistas con contenido primero; la mezcla original al final.
        current["stems"].sort(key=lambda st: (st["id"] == "mezcla", not st.get("active", True)))
        current.setdefault("instruments_method", "actividad de las pistas")
        if len(current["stems"]) > 1 and not current.get("instruments"):
            current["instruments"] = song_instruments(current["stems"])
    return _mutate(job_id, apply)


def _tag_instruments(job_id: str) -> dict:
    """Reconoce los instrumentos de cada pista con el clasificador (lento; en proceso aparte)."""
    from app.domain.instruments import song_instruments, stem_label, summarize
    from app.infrastructure import instrument_tagger
    if not instrument_tagger.available():
        return _update(job_id, instruments_status="no disponible")
    meta = _update(job_id, instruments_status="analizando", instruments_error=None)
    folder = ROOT / job_id
    paths = {st["id"]: str(folder / st["file"]) for st in meta["stems"] if st.get("active", True)}
    try:
        tagged = instrument_tagger.tag_many(list(paths.values()))
    except Exception as e:  # modelo sin descargar, sin red, tiempo agotado…: la canción sigue siendo usable
        return _update(job_id, instruments_status="error", instruments_error=str(e)[:300])
    windows = {sid: tagged.get(p, []) for sid, p in paths.items()}

    # El análisis ha tardado: se aplican solo sus campos sobre la versión actual del
    # fichero, para no pisar lo que el usuario haya cambiado mientras tanto.
    def apply(current: dict) -> None:
        for st in current["stems"]:
            if st["id"] in windows:
                st["instruments"] = summarize(windows[st["id"]])
                st["name"] = stem_label(st["id"], st["instruments"])
        current["instruments"] = song_instruments(current["stems"]) if current.get("separated", True) else summarize(windows.get("mezcla", []))
        current["instruments_method"] = "AST (AudioSet)"
        current["instruments_status"] = "listo"
    return _mutate(job_id, apply)


def _start_tagging(job_id: str) -> None:
    _aux_pool.submit(_tag_instruments, job_id)


def _detect_instruments(job_id: str) -> dict:
    """Actividad de las pistas + instrumentos, de una vez (botón ↻ y tests)."""
    _stem_activity(job_id)
    return _tag_instruments(job_id)


def detect_instruments(job_id: str) -> dict:
    """Vuelve a analizar los instrumentos de una canción ya procesada (en segundo plano)."""
    meta = _update(job_id, instruments_status="analizando", instruments_error=None)
    _aux_pool.submit(_detect_instruments, job_id)
    return meta


def instrument_capabilities() -> dict:
    from app.infrastructure import instrument_tagger
    return {"tagger": instrument_tagger.available(), "model": instrument_tagger.MODEL}


def guitar_arrangement(job_id: str, capo: int | None = None) -> dict:
    """Posición de guitarra para cada acorde de la canción (con la cejilla indicada o la recomendada)."""
    from app.domain.guitar import arrange_song, suggest_capo
    segs = (load(job_id).get("analysis") or {}).get("segments", [])
    symbols = [s["symbol"].split(" ")[0] if s["symbol"] != "N" else "N" for s in segs]
    suggestions = suggest_capo(symbols)[:4]
    if capo is None:
        capo = suggestions[0]["capo"] if suggestions else 0
    if not 0 <= capo <= 12:
        raise ValueError("La cejilla debe estar entre 0 y 12")
    shapes = arrange_song(symbols, capo)
    items = [{"index": i, "start": s["start"], "end": s["end"], "symbol": s["symbol"], "shape": sh or None}
             for i, (s, sh) in enumerate(zip(segs, shapes))]
    return {"capo": capo, "suggestions": suggestions, "items": items}
