import { useCallback, useEffect, useRef, useState } from 'react'
import { Tone, ensureAudio } from './audio'
import { subscribeNotes, type NoteEvent } from './input'

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

/** Grabadora de lo que se toca (MIDI, ratón o teclado). Empieza a contar en la primera nota. */
export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [take, setTake] = useState<RecordedNote[]>([])
  const events = useRef<NoteEvent[]>([])

  useEffect(() => subscribeNotes((e) => { if (recording) events.current.push(e) }), [recording])

  const start = useCallback(() => { events.current = []; setTake([]); setRecording(true) }, [])
  const stop = useCallback(() => { setRecording(false); setTake(eventsToNotes(events.current)) }, [])

  const play = useCallback(async (notes: RecordedNote[] = take) => {
    const inst = await ensureAudio()
    const t = Tone.now() + 0.05
    notes.forEach((n) => inst.triggerAttackRelease(Tone.Frequency(n.note, 'midi').toFrequency(),
      Math.max(0.05, (n.end - n.start) / 1000), t + n.start / 1000, Math.max(0.2, n.velocity)))
  }, [take])

  return { recording, take, start, stop, play, setTake }
}

/** Notas grabadas → acordes para exportar a MIDI respetando el tiempo (resolución de 1/16 a 120). */
export function takeDurationMs(take: RecordedNote[]) {
  return take.reduce((m, n) => Math.max(m, n.end), 0)
}
