import { useCallback, useEffect, useRef, useState } from 'react'
import { Tone, click, ensureAudio } from './audio'

export interface PracticeOptions { bpm: number; beatsPerChord: number; loop: boolean; metronome: boolean }

/**
 * Reproductor de práctica: toca una progresión a tempo, con metrónomo y en bucle,
 * usando el reloj de audio de Tone.js para que el pulso no se desplace.
 */
export function usePractice(chords: number[][], onChord?: (i: number) => void) {
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(-1)
  const loopRef = useRef<Tone.Loop | null>(null)
  const cbRef = useRef(onChord)
  cbRef.current = onChord

  const stop = useCallback(() => {
    loopRef.current?.dispose()
    loopRef.current = null
    Tone.getTransport().stop()
    setPlaying(false)
    setBeat(-1)
  }, [])

  const start = useCallback(async (o: PracticeOptions) => {
    stop()
    if (!chords.length) return
    const inst = await ensureAudio()
    const transport = Tone.getTransport()
    transport.bpm.value = o.bpm
    let n = 0
    const total = chords.length * o.beatsPerChord
    loopRef.current = new Tone.Loop((time) => {
      if (!o.loop && n >= total) { Tone.getDraw().schedule(stop, time); return }
      const b = n % total
      const i = Math.floor(b / o.beatsPerChord)
      if (b % o.beatsPerChord === 0) {
        const dur = (60 / o.bpm) * o.beatsPerChord * 0.95
        chords[i].forEach((m) => inst.triggerAttackRelease(Tone.Frequency(m, 'midi').toFrequency(), dur, time, 0.6))
        Tone.getDraw().schedule(() => cbRef.current?.(i), time)
      }
      if (o.metronome) click(b % o.beatsPerChord === 0, time)
      Tone.getDraw().schedule(() => setBeat(b % o.beatsPerChord), time)
      n++
    }, '4n').start(0)
    transport.position = 0
    transport.start('+0.05')
    setPlaying(true)
  }, [chords, stop])

  useEffect(() => stop, [stop])
  return { playing, beat, start, stop }
}
