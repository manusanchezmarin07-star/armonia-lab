"""Base de conocimiento local (ficheros Markdown con fuentes) y búsqueda BM25.

Se implementa BM25 a mano en lugar de usar embeddings: no necesita GPU ni
descargar modelos extra, es determinista y para unos cientos de fragmentos de
texto en español funciona de sobra.
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.config import KNOWLEDGE_DIR

STOPWORDS = set("""a al algo ante como con cual cuando de del desde donde el ella ellos en entre era es esa ese
eso esta este esto fue ha hay la las le les lo los mas me mi muy no nos o para pero por que se sea ser si sin sobre
su sus tambien te tiene un una uno unos y ya yo tu que cual cuales como porque puedo puede hace hacer""".split())


def normalize(text: str) -> list[str]:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    tokens = re.findall(r"[a-z0-9#]+", text)
    out = []
    for t in tokens:
        if t in STOPWORDS or len(t) < 2:
            continue
        # Stemming mínimo: plurales y femeninos frecuentes ("acordes"->"acord", "menores"->"menor").
        for suf in ("es", "s", "as", "os", "a", "o"):
            if len(t) > 5 and t.endswith(suf):
                t = t[: -len(suf)]
                break
        out.append(t)
    return out


@dataclass
class Chunk:
    doc_title: str
    heading: str
    text: str
    sources: list[str]
    file: str

    @property
    def tokens(self) -> list[str]:
        return normalize(self.heading + " " + self.heading + " " + self.text)


def _parse(path: Path) -> list[Chunk]:
    raw = path.read_text(encoding="utf-8")
    meta, body = {}, raw
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = m.group(2)
    sources = [s.strip() for s in meta.get("sources", "").split("|") if s.strip()]
    chunks = []
    for part in re.split(r"^## ", body, flags=re.M):
        part = part.strip()
        if not part:
            continue
        heading, _, text = part.partition("\n")
        chunks.append(Chunk(meta.get("title", path.stem), heading.strip(), text.strip(), sources, path.name))
    return chunks


class KnowledgeBase:
    def __init__(self, folder: Path):
        self.chunks: list[Chunk] = []
        for p in sorted(folder.glob("*.md")):
            self.chunks.extend(_parse(p))
        self._tf = [Counter(c.tokens) for c in self.chunks]
        self._len = [sum(tf.values()) for tf in self._tf]
        self._avg = sum(self._len) / max(1, len(self._len))
        df: Counter = Counter()
        for tf in self._tf:
            df.update(tf.keys())
        n = len(self.chunks)
        self._idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}
        self.vocabulary = set(df)

    def search(self, query: str, k: int = 4) -> list[tuple[float, Chunk]]:
        q = normalize(query)
        k1, b = 1.5, 0.75
        scored = []
        for i, tf in enumerate(self._tf):
            s = 0.0
            for t in q:
                if t in tf:
                    f = tf[t]
                    s += self._idf[t] * f * (k1 + 1) / (f + k1 * (1 - b + b * self._len[i] / self._avg))
            if s > 0:
                scored.append((s, self.chunks[i]))
        scored.sort(key=lambda x: -x[0])
        return scored[:k]


@lru_cache(maxsize=1)
def get_kb() -> KnowledgeBase:
    return KnowledgeBase(KNOWLEDGE_DIR)
