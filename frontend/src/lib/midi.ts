import { useEffect, useRef, useState } from 'react'

// Web MIDI: funciona con cualquier teclado "class compliant" por USB (Alesis Q49,
// pianos digitales con USB-MIDI) en Chrome/Edge sin drivers.
export interface MidiState {
  supported: boolean
  devices: string[]
  error: string | null
}

type Listener = (type: 'on' | 'off', note: number, velocity: number) => void
const listeners = new Set<Listener>()
let access: MIDIAccess | null = null
let sustain = false
const sustained = new Set<number>()
const down = new Set<number>()

// Mensajes que no son notas (ruedas, faders, botones): los usan los controles asignables.
export type ControlEvent =
  | { kind: 'cc'; cc: number; value: number }
  | { kind: 'bend'; value: number } // -1 … +1
  | { kind: 'program'; value: number }
const controlListeners = new Set<(e: ControlEvent) => void>()
export function subscribeControl(fn: (e: ControlEvent) => void) {
  controlListeners.add(fn)
  return () => { controlListeners.delete(fn) }
}

// Monitor: todos los mensajes en bruto, para ver qué envía cada botón del teclado.
const rawListeners = new Set<(bytes: number[]) => void>()
export function subscribeRaw(fn: (bytes: number[]) => void) {
  rawListeners.add(fn)
  return () => { rawListeners.delete(fn) }
}

// Transporte aplicado a las notas que llegan del teclado (en semitonos). Se recuerda
// la nota transportada de cada tecla pulsada para soltarla igual aunque el transporte
// cambie con la tecla aún pulsada (si no, quedarían notas colgadas).
let transpose = 0
const held = new Map<number, number>()
export const getTranspose = () => transpose
export function setTranspose(n: number) { transpose = Math.max(-24, Math.min(24, Math.round(n))) }

function emit(type: 'on' | 'off', note: number, vel: number) {
  listeners.forEach((l) => l(type, note, vel))
}

function onMessage(e: MIDIMessageEvent) {
  const data = e.data
  if (!data) return
  rawListeners.forEach((l) => l([...data]))
  const [status, d1, d2] = data
  const cmd = status & 0xf0
  if (cmd === 0x90 && d2 > 0) {
    const note = Math.max(0, Math.min(127, d1 + transpose))
    held.set(d1, note)
    down.add(note)
    sustained.delete(note)
    emit('on', note, d2 / 127)
  } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
    const note = held.get(d1) ?? d1 + transpose
    held.delete(d1)
    down.delete(note)
    // Con el pedal pisado la nota sigue sonando: se libera al soltar el pedal.
    if (sustain) sustained.add(note)
    else emit('off', note, 0)
  } else if (cmd === 0xb0 && d1 === 64) {
    sustain = d2 >= 64
    if (!sustain) {
      sustained.forEach((n) => emit('off', n, 0))
      sustained.clear()
    }
  } else if (cmd === 0xb0) {
    controlListeners.forEach((l) => l({ kind: 'cc', cc: d1, value: d2 }))
  } else if (cmd === 0xe0) {
    // Pitch bend de 14 bits: 8192 es el centro.
    const v = ((d2 << 7) | d1) - 8192
    controlListeners.forEach((l) => l({ kind: 'bend', value: v / 8192 }))
  } else if (cmd === 0xc0) {
    controlListeners.forEach((l) => l({ kind: 'program', value: d1 }))
  }
}

/** Solo para pruebas y para el panel: inyecta un mensaje como si viniera del teclado. */
export function simulateMidi(bytes: number[]) {
  onMessage({ data: new Uint8Array(bytes) } as MIDIMessageEvent)
}

export function subscribeMidi(l: Listener) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useMidiDevices(): MidiState {
  const [state, setState] = useState<MidiState>({ supported: 'requestMIDIAccess' in navigator, devices: [], error: null })
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !('requestMIDIAccess' in navigator)) return
    started.current = true
    const refresh = () => {
      if (!access) return
      const names: string[] = []
      access.inputs.forEach((inp) => {
        inp.onmidimessage = onMessage
        names.push(inp.name || 'Dispositivo MIDI')
      })
      setState((s) => ({ ...s, devices: names }))
    }
    navigator.requestMIDIAccess().then((a) => {
      access = a
      refresh()
      a.onstatechange = refresh // conectar/desconectar en caliente
    }).catch((err) => setState((s) => ({ ...s, error: String(err) })))
  }, [])
  return state
}
