import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { noteOff, noteOn } from './audio'
import { subscribeMidi, useMidiDevices, type MidiState } from './midi'

// Estado global de "lo que está sonando": une MIDI, ratón y teclado del ordenador
// en un único conjunto de notas para que todas las pantallas reaccionen igual.
interface InputCtx {
  pressed: Set<number>
  midi: MidiState
  soundOnMidi: boolean
  setSoundOnMidi: (v: boolean) => void
  press: (m: number, vel?: number) => void
  release: (m: number) => void
  octave: number
  lastChord: number[]
}

const Ctx = createContext<InputCtx | null>(null)

// Distribución tipo DAW: fila central = teclas blancas, fila superior = negras.
const PC_KEYS: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, 'ñ': 16, ';': 16,
}

export function InputProvider({ children }: { children: ReactNode }) {
  const midi = useMidiDevices()
  const [pressed, setPressed] = useState<Set<number>>(new Set())
  const [soundOnMidi, setSoundOnMidi] = useState(true)
  const [octave, setOctave] = useState(4)
  const [lastChord, setLastChord] = useState<number[]>([])
  const soundRef = useRef(soundOnMidi)
  soundRef.current = soundOnMidi

  // "Último acorde": se congela lo tocado al soltar, para poder leer el análisis
  // con las manos ya fuera del teclado.
  const update = useCallback((fn: (s: Set<number>) => void) => {
    setPressed((prev) => {
      const next = new Set(prev)
      fn(next)
      if (next.size >= 1 && next.size >= prev.size) setLastChord([...next].sort((a, b) => a - b))
      return next
    })
  }, [])

  const press = useCallback((m: number, vel = 0.75) => { noteOn(m, vel); update((s) => s.add(m)) }, [update])
  const release = useCallback((m: number) => { noteOff(m); update((s) => s.delete(m)) }, [update])

  useEffect(() => subscribeMidi((type, note, vel) => {
    if (type === 'on') {
      if (soundRef.current) noteOn(note, Math.max(0.15, vel))
      update((s) => s.add(note))
    } else {
      if (soundRef.current) noteOff(note)
      update((s) => s.delete(note))
    }
  }), [update])

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (e.repeat || isTyping(e) || e.ctrlKey || e.metaKey) return
      const k = e.key.toLowerCase()
      if (k === 'z') return setOctave((o) => Math.max(1, o - 1))
      if (k === 'x') return setOctave((o) => Math.min(7, o + 1))
      if (k in PC_KEYS) press((octave + 1) * 12 + PC_KEYS[k])
    }
    const up = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      const k = e.key.toLowerCase()
      if (k in PC_KEYS) release((octave + 1) * 12 + PC_KEYS[k])
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [octave, press, release])

  const value = useMemo(() => ({ pressed, midi, soundOnMidi, setSoundOnMidi, press, release, octave, lastChord }),
    [pressed, midi, soundOnMidi, press, release, octave, lastChord])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useInput() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useInput fuera de InputProvider')
  return c
}
