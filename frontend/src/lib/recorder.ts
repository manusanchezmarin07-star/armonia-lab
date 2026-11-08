import { useCallback, useEffect, useRef, useState } from 'react'
import { Tone, ensureAudio } from './audio'
import { subscribeNotes, type NoteEvent } from './input'
import { eventsToNotes, type RecordedNote } from './takes'

export type { RecordedNote } from './takes'

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
