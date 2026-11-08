// Lógica pura de las tomas grabadas (sin audio ni React): se puede testear aislada.
import type { NoteEvent } from './input'

export interface RecordedNote { note: number; start: number; end: number; velocity: number }

/** Convierte eventos on/off en notas con inicio y fin (ms relativos al principio). */
export function eventsToNotes(events: NoteEvent[]): RecordedNote[] {
  if (!events.length) return []
  const t0 = events[0].time
  const open = new Map<number, NoteEvent>()
  const out: RecordedNote[] = []
  for (const e of events) {
    if (e.type === 'on') open.set(e.note, e)
    else {
      const on = open.get(e.note)
      if (on) { out.push({ note: e.note, start: on.time - t0, end: e.time - t0, velocity: on.velocity }); open.delete(e.note) }
    }
  }
  const last = events[events.length - 1].time - t0
  open.forEach((on) => out.push({ note: on.note, start: on.time - t0, end: last + 300, velocity: on.velocity }))
  return out.sort((a, b) => a.start - b.start)
}


/**
 * Agrupa una toma en acordes: notas que empiezan casi a la vez (≤ 90 ms) forman un
 * mismo acorde. Así una progresión tocada en bloques se convierte en cifrado.
 */
export function groupChords(take: RecordedNote[], windowMs = 90): number[][] {
  const groups: number[][] = []
  let start = -Infinity
  take.forEach((n) => {
    if (n.start - start > windowMs) { groups.push([]); start = n.start }
    groups[groups.length - 1].push(n.note)
  })
  return groups.filter((g) => new Set(g.map((x) => x % 12)).size >= 2)
}
