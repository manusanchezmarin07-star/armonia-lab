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


def create(filename: str, data: bytes, model: str, separate: bool = True) -> dict:
    job_id = uuid.uuid4().hex[:12]
    folder = ROOT / job_id
    folder.mkdir(parents=True)
    ext = Path(filename).suffix.lower() or ".mp3"
    src = folder / f"original{ext}"
    src.write_bytes(data)
    do_sep = separate and separation.demucs_available()
    meta = {"id": job_id, "title": Path(filename).stem, "filename": filename, "status": "en cola", "progress": 0.0,
            "message": "", "model": model if do_sep else None, "separated": False, "stems": [], "analysis": None,
            "device": separation.gpu_info() if do_sep else None}
    _save(meta)
    _pool.submit(_run, job_id, src, model, do_sep)
    return meta


def _run(job_id: str, src: Path, model: str, do_sep: bool) -> None:
    from app.infrastructure import audio_analysis
    try:
        stems: dict[str, Path] = {}
        if do_sep:
            _update(job_id, status="separando pistas", progress=0.1,
                    message="Demucs está separando los instrumentos (con GPU tarda ~1 min por canción).")
            stems = separation.separate(src, ROOT / job_id / "sep", model)
        _update(job_id, status="analizando acordes", progress=0.7, message="Detectando pulso, tonalidad y acordes…")
        harmonic = [str(p) for n, p in stems.items() if n not in HARMONIC_EXCLUDE] or [str(src)]
        bass = str(stems["bass"]) if "bass" in stems else None
        analysis = audio_analysis.analyze(harmonic, bass)
        _attach_roman(analysis)
        stem_list = [{"id": n, "name": STEM_NAMES.get(n, n), "file": str(p.relative_to(ROOT / job_id))} for n, p in stems.items()]
        stem_list.append({"id": "mezcla", "name": STEM_NAMES["mezcla"], "file": src.name})
        _update(job_id, status="reconociendo instrumentos", progress=0.85, message="Viendo qué suena en cada pista…",
                separated=bool(stems), stems=stem_list, analysis=analysis)
        _detect_instruments(job_id)
        _update(job_id, status="listo", progress=1.0, message="")
    except Exception as e:  # se guarda el error para mostrarlo en la interfaz
        _update(job_id, status="error", message=str(e)[:1000])


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

def _detect_instruments(job_id: str) -> dict:
    """Marca qué pistas tienen contenido y, si el clasificador está instalado, qué instrumentos suenan.

    Las pistas vacías se ocultan en el mezclador y las demás se renombran por su
    contenido real («Otros» → «Cuerdas frotadas: violín, chelo»).
    """
    import librosa

    from app.domain.instruments import stem_label, summarize
    from app.infrastructure import audio_analysis, instrument_tagger
    meta = load(job_id)
    folder = ROOT / job_id
    mix = folder / meta["stems"][-1]["file"]
    y = audio_analysis.load_mono([str(mix)])
    ref = float(librosa.feature.rms(y=y, hop_length=2048)[0].max()) if len(y) else 1.0
    tagger = instrument_tagger.available()
    song_windows: list[dict] = []
    for st in meta["stems"]:
        path = folder / st["file"]
        act = audio_analysis.stem_activity(str(path), ref_peak=ref)
        st["activity"] = act
        st["active"] = act["has_content"] or st["id"] == "mezcla"
        st["instruments"] = []
        if tagger and st["active"]:
            try:
                windows = instrument_tagger.tag_windows(str(path))
                st["instruments"] = summarize(windows)
                if st["id"] == "mezcla":
                    song_windows = windows
            except Exception as e:  # el modelo puede no estar descargado o fallar: no bloquea el resto
                meta["instruments_error"] = str(e)[:300]
                tagger = False
        st["name"] = stem_label(st["id"], st["instruments"])
    results = {st["id"]: {k: st[k] for k in ("activity", "active", "instruments", "name")} for st in meta["stems"]}
    error = meta.get("instruments_error")

    # El análisis ha tardado: se aplican solo sus campos sobre la versión actual del
    # fichero, para no pisar lo que el usuario haya cambiado mientras tanto.
    def apply(current: dict) -> None:
        for st in current["stems"]:
            st.update(results.get(st["id"], {}))
        # Pistas con contenido primero; la mezcla original al final.
        current["stems"].sort(key=lambda st: (st["id"] == "mezcla", not st.get("active", True)))
        current["instruments"] = summarize(song_windows) if song_windows else []
        current["instruments_method"] = "AST (AudioSet)" if tagger else "actividad de las pistas"
        if error:
            current["instruments_error"] = error
    return _mutate(job_id, apply)


def detect_instruments(job_id: str) -> dict:
    """Vuelve a analizar los instrumentos de una canción ya procesada (en segundo plano)."""
    meta = load(job_id)
    _pool.submit(_detect_instruments, job_id)
    return meta


def instrument_capabilities() -> dict:
    from app.infrastructure import instrument_tagger
    return {"tagger": instrument_tagger.available(), "model": instrument_tagger.MODEL}
