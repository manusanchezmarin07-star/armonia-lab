// Guitarra en el cliente: afinación, posiciones de una nota y colocación compacta
// de un conjunto de notas en el mástil (para dibujar cualquier voicing).

/** Afinación estándar, de la 6ª (índice 0, Mi grave) a la 1ª (índice 5, Mi agudo). */
export const TUNING = [40, 45, 50, 55, 59, 64]
export const STRING_LABELS = ['6ª', '5ª', '4ª', '3ª', '2ª', '1ª']
export const MAX_FRET = 15
export const LOWEST = TUNING[0]
export const HIGHEST = TUNING[5] + MAX_FRET

export interface Pos { string: number; fret: number } // string: 6..1 como los guitarristas

/** Todas las posiciones (cuerda, traste) donde suena una nota MIDI. */
export function positionsOf(midi: number, maxFret = MAX_FRET): Pos[] {
  const out: Pos[] = []
  TUNING.forEach((open, i) => {
    const f = midi - open
    if (f >= 0 && f <= maxFret) out.push({ string: 6 - i, fret: f })
  })
  return out
}

export const midiAt = (p: Pos) => TUNING[6 - p.string] + p.fret

/** Lleva una nota al registro de la guitarra (Mi2–Sol5) cambiando de octava si hace falta. */
export function intoRange(midi: number) {
  let m = midi
  while (m < LOWEST) m += 12
  while (m > HIGHEST) m -= 12
  return m
}

/**
 * Coloca un conjunto de notas en el mástil: una nota por cuerda y la posición
 * más compacta (poca distancia entre trastes y cerca de la cejilla). Se usa para
 * mostrar en la guitarra voicings pensados para piano o lo que llega por MIDI.
 */
export function layout(notes: number[]): Pos[] {
  const uniq = [...new Set(notes.map(intoRange))].sort((a, b) => a - b).slice(0, 6)
  let best: Pos[] | null = null
  let bestCost = Infinity
  const used = new Set<number>()
  const chosen: Pos[] = []
  const go = (k: number) => {
    if (k === uniq.length) {
      const fretted = chosen.filter((p) => p.fret > 0).map((p) => p.fret)
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0
      const cost = span * 3 + (fretted.length ? Math.min(...fretted) : 0) * 0.4 + (span > 4 ? 50 : 0)
      if (cost < bestCost) { bestCost = cost; best = [...chosen] }
      return
    }
    for (const p of positionsOf(uniq[k])) {
      // Notas más agudas en cuerdas más agudas: así no se cruzan las cuerdas.
      const prev = chosen[chosen.length - 1]
      if (used.has(p.string) || (prev && p.string >= prev.string)) continue
      used.add(p.string); chosen.push(p)
      go(k + 1)
      used.delete(p.string); chosen.pop()
    }
  }
  go(0)
  // Si no cabe (demasiadas notas o registros imposibles), cada nota en su posición más baja.
  return best ?? uniq.map((m) => positionsOf(m).sort((a, b) => a.fret - b.fret)[0]).filter(Boolean)
}

export interface Shape {
  symbol: string; frets: number[]; fingers: number[]; barre: { fret: number; from_string: number; to_string: number } | null
  base_fret: number; position: number; name: string; capo: number; diagram: string
  /** Con cejilla, la forma que se hace (Bb con cejilla en III → «G»); sin cejilla, el propio acorde. */
  shape_of?: string
  notes: { string: number; fret: number; midi: number; note: string; role: string; finger: number }[]
}
