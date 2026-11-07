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

function emit(type: 'on' | 'off', note: number, vel: number) {
  listeners.forEach((l) => l(type, note, vel))
}

function onMessage(e: MIDIMessageEvent) {
  const data = e.data
  if (!data) return
  const [status, d1, d2] = data
  const cmd = status & 0xf0
  if (cmd === 0x90 && d2 > 0) {
    down.add(d1)
    sustained.delete(d1)
    emit('on', d1, d2 / 127)
  } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
    down.delete(d1)
    // Con el pedal pisado la nota sigue sonando: se libera al soltar el pedal.
    if (sustain) sustained.add(d1)
    else emit('off', d1, 0)
  } else if (cmd === 0xb0 && d1 === 64) {
    sustain = d2 >= 64
    if (!sustain) {
      sustained.forEach((n) => emit('off', n, 0))
      sustained.clear()
    }
  }
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
