import { useEffect, useState } from 'react'
import ChordDiagram from './ChordDiagram'
import { api } from '../lib/api'
import type { Shape } from '../lib/guitar'

// Caché de la mejor posición por acorde: las tarjetas de rearmonización piden muchos
// acordes repetidos y así no se repite la petición al cambiar de vista.
const cache = new Map<string, Promise<Shape | null>>()
function bestShape(symbol: string) {
  if (!cache.has(symbol)) {
    cache.set(symbol, api.get<Shape[]>(`/api/guitar/chord?symbol=${encodeURIComponent(symbol)}&limit=1`).then((s) => s[0] ?? null).catch(() => null))
  }
  return cache.get(symbol)!
}

/** Diagrama pequeño con la posición más cómoda de un acorde (para listas de acordes en modo guitarra). */
export default function MiniShape({ symbol, size = 0.62, onClick }: { symbol: string; size?: number; onClick?: () => void }) {
  const [shape, setShape] = useState<Shape | null>(null)
  useEffect(() => { let live = true; bestShape(symbol).then((s) => live && setShape(s)); return () => { live = false } }, [symbol])
  if (!shape) return null
  return <ChordDiagram shape={shape} size={size} onClick={onClick} />
}
