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

// Bus de eventos de nota con marca de tiempo (todas las fuentes: MIDI, ratón y
// teclado). Lo usan la grabadora y el tutor, que necesitan el orden y el momento
// exacto de cada nota y no solo "qué está pulsado ahora".
export interface NoteEvent { type: 'on' | 'off'; note: number; velocity: number; time: number; source: 'midi' | 'pantalla' }
const noteListeners = new Set<(e: NoteEvent) => void>()
const emit = (e: Omit<NoteEvent, 'time'>) => { const ev = { ...e, time: performance.now() }; noteListeners.forEach((l) => l(ev)) }
export function subscribeNotes(fn: (e: NoteEvent) => void) {
  noteListeners.add(fn)
  return () => { noteListeners.delete(fn) }
}

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

  const press = useCallback((m: number, vel = 0.75) => {
    noteOn(m, vel); update((s) => s.add(m)); emit({ type: 'on', note: m, velocity: vel, source: 'pantalla' })
  }, [update])
  const release = useCallback((m: number) => {
    noteOff(m); update((s) => s.delete(m)); emit({ type: 'off', note: m, velocity: 0, source: 'pantalla' })
  }, [update])

  useEffect(() => subscribeMidi((type, note, vel) => {
    if (type === 'on') {
      if (soundRef.current) noteOn(note, Math.max(0.15, vel))
      update((s) => s.add(note))
    } else {
      if (soundRef.current) noteOff(note)
      update((s) => s.delete(note))
    }
    emit({ type, note, velocity: vel, source: 'midi' })
  }), [update])

  // Nota que suena por cada tecla del ordenador pulsada: al soltar se libera esa
  // misma nota aunque entretanto haya cambiado la octava (si no, quedaba colgada).
  const pcHeld = useRef(new Map<string, number>())
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
      if (k in PC_KEYS && !pcHeld.current.has(k)) {
        const m = (octave + 1) * 12 + PC_KEYS[k]
        pcHeld.current.set(k, m)
        press(m)
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const m = pcHeld.current.get(k)
      if (m !== undefined) { pcHeld.current.delete(k); release(m) }
    }
    // Al cambiar de ventana no llega el keyup: se sueltan todas para no dejar notas colgadas.
    const blur = () => { pcHeld.current.forEach((m) => release(m)); pcHeld.current.clear() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
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
