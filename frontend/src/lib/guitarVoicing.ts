// Posición de guitarra para un grupo de notas (un voicing pensado para piano).
import { useEffect, useState } from 'react'
import { api } from './api'
import type { Shape } from './guitar'

// Caché por conjunto de notas: cada mástil pide lo mismo muchas veces al repintarse.
const cache = new Map<string, Promise<Shape | null>>()
const resolved = new Map<string, Shape | null>()

/** Clave del acorde: el bajo y las clases de nota (la octava no cambia la posición de guitarra). */
export function voicingKey(notes: number[]): string {
  if (!notes.length) return ''
  const bass = Math.min(...notes) % 12
  return `${bass}|${[...new Set(notes.map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b).join(',')}`
}

/**
 * Posición natural de guitarra para esas notas, o null si no forman un acorde
 * (entonces quien llama las coloca tal cual en el mástil). Mientras llega la
 * respuesta devuelve `undefined`.
 */
export function useGuitarVoicing(notes: number[], enabled = true): Shape | null | undefined {
  const key = enabled ? voicingKey(notes) : ''
  const [, bump] = useState(0)
  useEffect(() => {
    if (!key || resolved.has(key)) return
    let live = true
    if (!cache.has(key)) {
      cache.set(key, api.post<{ shape: Shape | null }>('/api/guitar/voicing', { notes }).then((r) => r.shape).catch(() => null))
    }
    cache.get(key)!.then((shape) => { resolved.set(key, shape); if (live) bump((x) => x + 1) })
    return () => { live = false }
  }, [key])
  if (!key) return null
  return resolved.has(key) ? resolved.get(key) : undefined
}
