"""Asistente de música local.

Principios para que no "se invente" teoría:
1. Los cálculos (notas de un acorde, grados, armonía negativa...) los hace el motor
   de teoría y se le pasan al modelo como HECHOS VERIFICADOS que debe copiar.
2. Las explicaciones salen de la base de conocimiento local (con fuentes), que se
   recupera con BM25 y se cita con [n].
3. Solo responde sobre música: filtro previo + instrucciones del sistema.
4. Sin Ollama funciona en "modo bot": devuelve los hechos y los fragmentos
   relevantes tal cual, sin redactar.
"""
from __future__ import annotations

import re
import unicodedata

from app.domain.analysis import negative_progression
from app.domain.chords import ParsedChord, parse_symbol
from app.domain.keys import Key, analyze_chord_in_key
from app.domain.modulation import explain_transition
from app.domain.scales import SCALES, scale_info
from app.infrastructure.knowledge_base import get_kb, normalize
from app.infrastructure.ollama_client import OllamaClient

MUSIC_TERMS = set(normalize("""
acorde acordes nota notas escala escalas modo modos armonia armonica tonalidad tonalidades compas compases ritmo
ritmos melodia cancion canciones piano teclado musica musical intervalo intervalos partitura partituras pentagrama
clave sostenido bemol mayor menor septima novena oncena trecena dominante subdominante tonica cadencia cadencias
modulacion modular modula pivote disminuido semidisminuido aumentado tritono sustituto negativa negativo voicing
voces voz conduccion bajo tension tensiones flamenco palo palos soleá solea buleria bulerias seguiriya alegrias
tangos sevillanas amalgama metronomo tempo pulso corchea negra blanca redonda semicorchea silencio frigio dorico
lidio mixolidio eolico locrio jonico pentatonica blues jazz collier bach messiaen coltrane simetrica simetrica
octatonica cromatica tonos grado grados romano funcion inversion arpegio improvisar improvisacion componer
composicion transcribir transcripcion oido midi alesis tocar toca sonar suena reharmonizar rearmonizar
""".replace("\n", " ")))

REJECTION = ("Solo puedo ayudarte con música: armonía, acordes, escalas, ritmo, lectura de partituras, piano o "
             "el análisis de obras y artistas. ¿Te ayudo con algo de eso?")

SYSTEM = """Eres el profesor de música de Armonía Lab. Hablas en español, de forma clara y cercana, para un
pianista que toca de oído y está aprendiendo teoría.

REGLAS OBLIGATORIAS:
1. Solo hablas de música. Si te preguntan otra cosa, responde exactamente: "{rejection}"
2. Los nombres de notas, acordes, grados y armonía negativa que aparecen en HECHOS VERIFICADOS están calculados
   por un motor de teoría probado: cópialos tal cual. No calcules notas ni intervalos por tu cuenta.
3. Basa las explicaciones en el CONTEXTO y cita el fragmento con [n]. Si el contexto no cubre la pregunta, dilo
   ("Esto no está en mi base de conocimiento") y da solo orientación general prudente.
4. No inventes datos sobre obras, grabaciones o biografías de artistas.
5. Sé breve (máximo unos 200 palabras) y termina, si tiene sentido, con un ejercicio práctico para el piano.
"""

SOLFEGE = {"do": "C", "re": "D", "mi": "E", "fa": "F", "sol": "G", "la": "A", "si": "B"}
_SUFFIX_ALT = r"maj13|maj9|maj7|m7b5|m\(maj7\)|mMaj7|dim7|dim|aug|sus4|sus2|7sus4|m13|m11|m9|m7|m6|6/9|7alt|7b9|7#9|7#11|7b13|add9|13|11|9|7|6|m|ø7|ø|°7|°|\+"
_SUFFIX = "(?:" + _SUFFIX_ALT + ")?"
_LATIN_RE = re.compile(r"(?<![\w#])([A-G](?:#|b)?" + _SUFFIX + r"(?:\([^)\s]*\))?(?:/[A-G](?:#|b)?)?)(?![\w#])")
_SOLF_RE = re.compile(r"(?<!\w)(Do|Re|Mi|Fa|Sol|La|Si)(#|b| sostenido| bemol)?(" + _SUFFIX_ALT + r")?(?![\w#])")
# Sin IGNORECASE a propósito: la nota debe ir en mayúscula para no confundir
# "en la tonalidad" con "en La".
_KEY_RE = re.compile(r"(?:[Ee]n|tonalidad de|tono de)\s+(Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b| sostenido| bemol)?\s*(mayor|menor|m\b)?")


def _acc(text: str | None) -> str:
    if not text:
        return ""
    t = text.strip()
    return "#" if t in ("#", "sostenido") else "b" if t in ("b", "bemol") else ""


def extract_chords(question: str) -> list[ParsedChord]:
    """Busca acordes escritos en cifrado americano o con nombres en español (Sol7, Rem, Fa#m7)."""
    found: list[ParsedChord] = []
    for m in _LATIN_RE.finditer(question):
        tok = m.group(1)
        # "A" y "E" sueltas son palabras en español; solo se aceptan tras "acorde".
        if tok in ("A", "E"):
            before = question[: m.start()].split()
            if not before or before[-1].lower() not in ("acorde", "acordes"):
                continue
        try:
            found.append(parse_symbol(tok))
        except ValueError:
            pass
    for m in _SOLF_RE.finditer(question):
        name, acc, suf = m.group(1), _acc(m.group(2)), m.group(3) or ""
        before = [w.lower().strip(",.:;") for w in question[: m.start()].split()]
        # "La" o "Mi" sin sufijo ni alteración son artículos/pronombres, salvo tras
        # "acorde" o "acorde de" (p. ej. "el acorde de La").
        after_acorde = (before[-1:] == ["acorde"]) or (before[-2:] == ["acorde", "de"])
        if not suf and not acc and not after_acorde:
            continue
        try:
            found.append(parse_symbol(SOLFEGE[name.lower()] + acc + suf))
        except ValueError:
            pass
    # Sin duplicados, conservando el orden de aparición.
    seen, out = set(), []
    for c in found:
        if c.symbol not in seen:
            seen.add(c.symbol)
            out.append(c)
    return out


def extract_key(question: str) -> Key | None:
    for m in _KEY_RE.finditer(question):
        name, acc, mode = m.group(1), _acc(m.group(2)), (m.group(3) or "").lower()
        if name.lower() in SOLFEGE:
            name = SOLFEGE[name.lower()]
        elif len(name) == 1 and name.islower():
            continue  # "en a ..." no es una tonalidad
        if mode == "" and name.upper() in ("A", "E") and len(m.group(1)) == 1:
            continue  # "en A" ambiguo sin "mayor/menor"
        try:
            return Key.parse(name.upper() + acc + ("m" if mode in ("menor", "m") else ""))
        except ValueError:
            continue
    return None


def compute_facts(question: str) -> list[str]:
    chords = extract_chords(question)
    key = extract_key(question)
    q = _plain(question)
    facts: list[str] = []
    for c in chords[:6]:
        facts.append(f"{c.symbol}: notas {' - '.join(c.spelled)} ({c.base.name_es}"
                     f"{', tensiones ' + ', '.join(c.tensions) if c.tensions else ''}).")
        if key:
            a = analyze_chord_in_key(key, c.root.pc, c.base.suffix, c.pcs)
            facts.append(f"En {key.name}, {c.symbol} es {a['roman']} ({a['kind']}). {a['explanation']}")
    if key and "negativ" in q and chords:
        neg = negative_progression(" ".join(c.symbol for c in chords[:6]), key.short)
        facts.append(f"Armonía negativa en {key.name} (eje {neg['axis']}): " +
                     ", ".join(f"{p['original']} → {p['negative']}" + (f" (= {', '.join(p['alternatives'])})" if p['alternatives'] else "")
                               for p in neg["pairs"]) + ".")
    if len(chords) >= 2 and "negativ" not in q:
        for a, b in list(zip(chords, chords[1:]))[:2]:
            t = explain_transition(a.symbol, b.symbol)
            facts.append(f"De {a.symbol} a {b.symbol}: notas comunes {', '.join(t['common_tones']) or 'ninguna'}; "
                         f"bajo se mueve una {t['root_motion']}. " + " ".join(t["relations"][:2]))
    if key and not chords:
        facts.append(f"Escala de {key.name}: {' - '.join(n.name for n in key.scale)}. Acordes: " +
                     ", ".join(f"{c['roman']}={c['symbol']}" for c in key.diatonic_chords(True)) + ".")
        for s in SCALES:
            if _plain(s.name.split(" (")[0]) in q and len(s.name) > 4:
                info = scale_info(key.tonic.name, s.id)
                facts.append(f"{key.tonic.name} {s.name}: {' - '.join(info['notes'])}.")
                break
    return facts


def _plain(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def is_music(question: str, history: list[dict], llm: OllamaClient | None) -> bool:
    tokens = set(normalize(question))
    if tokens & MUSIC_TERMS or extract_chords(question):
        return True
    hits = get_kb().search(question, k=1)
    if hits and hits[0][0] > 4.0:
        return True
    # Seguimiento sin contenido propio ("¿y por qué?", "¿y eso?") dentro de una
    # conversación musical. Si trae palabras de otro tema ("receta de paella") no cuela.
    if history and len(tokens) <= 1 and len(question.split()) <= 6:
        return True
    if llm is not None:
        try:
            verdict = llm.chat([
                {"role": "system", "content": "Clasifica si la pregunta trata de música (teoría, instrumentos, "
                                              "ritmo, canciones, artistas, práctica musical). Responde solo SI o NO."},
                {"role": "user", "content": question}], temperature=0, max_tokens=3)
            return verdict.strip().upper().startswith("S")
        except Exception:
            return False
    return False


def answer(messages: list[dict], llm: OllamaClient | None = None) -> dict:
    """Responde la última pregunta del usuario. `llm=None` usa el cliente por defecto si está disponible."""
    if not messages or messages[-1].get("role") != "user":
        raise ValueError("Falta la pregunta")
    question = messages[-1]["content"].strip()
    history = messages[:-1][-6:]
    client = llm if llm is not None else OllamaClient()
    active = client if client.status()["available"] else None

    if not is_music(question, history, active):
        return {"answer": REJECTION, "mode": "rechazo", "sources": [], "facts": []}

    facts = compute_facts(question)
    # Se busca con la pregunta y el último turno para que los seguimientos encuentren contexto.
    query = question + " " + " ".join(m["content"] for m in history[-2:] if m["role"] == "user")
    hits = get_kb().search(query, k=4)
    sources = [{"n": i + 1, "title": c.doc_title, "heading": c.heading, "refs": c.sources, "file": c.file}
               for i, (_, c) in enumerate(hits)]

    if active is None:
        parts = []
        if facts:
            parts.append("**Hechos calculados por el motor de teoría:**\n" + "\n".join(f"- {f}" for f in facts))
        for i, (_, c) in enumerate(hits[:2]):
            parts.append(f"**[{i + 1}] {c.doc_title} · {c.heading}**\n{c.text}")
        if not parts:
            parts.append("No encuentro nada sobre eso en la base de conocimiento local. Prueba con otras palabras "
                         "(por ejemplo: modulación, armonía negativa, dórico, soleá).")
        return {"answer": "\n\n".join(parts), "mode": "bot", "sources": sources[:2], "facts": facts}

    context = "\n\n".join(f"[{i + 1}] {c.doc_title} — {c.heading}\n{c.text}" for i, (_, c) in enumerate(hits))
    user_block = (f"HECHOS VERIFICADOS:\n{chr(10).join('- ' + f for f in facts) if facts else '(ninguno)'}\n\n"
                  f"CONTEXTO:\n{context or '(vacío)'}\n\nPREGUNTA: {question}")
    msgs = [{"role": "system", "content": SYSTEM.format(rejection=REJECTION)}]
    msgs += [{"role": m["role"], "content": m["content"]} for m in history if m["role"] in ("user", "assistant")]
    msgs.append({"role": "user", "content": user_block})
    try:
        text = active.chat(msgs)
    except Exception as e:  # Ollama caído a mitad: se degrada a modo bot en vez de fallar
        fallback = answer(messages, llm=_Offline())
        fallback["warning"] = f"El modelo local no respondió ({e.__class__.__name__}); respuesta en modo bot."
        return fallback
    return {"answer": text, "mode": "ia", "sources": sources, "facts": facts, "model": active.model}


class _Offline(OllamaClient):
    """Cliente que siempre aparece como no disponible (fuerza el modo bot)."""

    def status(self) -> dict:
        return {"available": False, "models": [], "model": self.model, "model_ready": False}


def status() -> dict:
    s = OllamaClient().status()
    return {**s, "knowledge_chunks": len(get_kb().chunks)}
