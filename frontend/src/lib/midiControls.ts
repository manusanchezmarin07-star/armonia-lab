import { useSyncExternalStore } from 'react'
import { setBend, setMasterVolume, setModulation } from './audio'
import { getTranspose, setTranspose, subscribeControl, type ControlEvent } from './midi'

// Acciones que se pueden asignar a los controles del teclado MIDI.
export const ACTIONS = {
  volumen: { label: 'Volumen general', kind: 'continuo', help: 'Fader o perilla: sube y baja el volumen de la app.' },
  modulacion: { label: 'Vibrato (modulación)', kind: 'continuo', help: 'Rueda de modulación: añade vibrato al sonido.' },
  'transponer+': { label: 'Transponer +½ tono', kind: 'boton', help: 'Cada pulsación sube medio tono lo que tocas.' },
  'transponer-': { label: 'Transponer −½ tono', kind: 'boton', help: 'Cada pulsación baja medio tono lo que tocas.' },
  'octava+': { label: 'Octava arriba', kind: 'boton', help: 'Sube una octava las notas del teclado.' },
  'octava-': { label: 'Octava abajo', kind: 'boton', help: 'Baja una octava las notas del teclado.' },
  reiniciar: { label: 'Quitar transporte', kind: 'boton', help: 'Vuelve a la afinación original (transporte 0).' },
  siguiente: { label: 'Siguiente / repetir', kind: 'boton', help: 'Equivale a pulsar Espacio: siguiente ejercicio en Oído y Lectura.' },
} as const
export type Action = keyof typeof ACTIONS

interface State {
  mappings: Record<string, Action> // "cc:7" → acción
  transpose: number
  learning: Action | null
  bend: number // -1…1
  bendWorks: boolean
  volume: number
  modulation: number
}

const KEY = 'armonia:midi.controls'
// Por defecto: CC7 es el estándar MIDI de volumen y CC1 el de la rueda de modulación.
const DEFAULT_MAPPINGS: Record<string, Action> = { 'cc:7': 'volumen', 'cc:1': 'modulacion' }

function load(): State {
  let saved: Partial<State> = {}
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { /* sin almacenamiento */ }
  const st: State = { mappings: saved.mappings ?? DEFAULT_MAPPINGS, transpose: saved.transpose ?? 0, learning: null,
    bend: 0, bendWorks: true, volume: saved.volume ?? 1, modulation: 0 }
  setTranspose(st.transpose)
  return st
}

let state: State = load()
const subs = new Set<() => void>()
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  if ('transpose' in patch) setTranspose(state.transpose)
  try { localStorage.setItem(KEY, JSON.stringify({ mappings: state.mappings, transpose: state.transpose, volume: state.volume })) } catch { /* nada */ }
  subs.forEach((f) => f())
}

export const controls = {
  get: () => state,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } },
  setTranspose: (n: number) => set({ transpose: Math.max(-24, Math.min(24, n)) }),
  learn: (a: Action | null) => set({ learning: a }),
  unmap: (id: string) => { const m = { ...state.mappings }; delete m[id]; set({ mappings: m }) },
  resetMappings: () => set({ mappings: DEFAULT_MAPPINGS }),
  setVolume: (v: number) => { setMasterVolume(v); set({ volume: v }) },
}

export const controlName = (id: string) => {
  const [kind, n] = id.split(':')
  if (kind === 'program') return 'Cambio de programa'
  const known: Record<string, string> = { '1': 'rueda de modulación', '7': 'volumen', '10': 'panorama', '11': 'expresión', '64': 'pedal de sostenido' }
  return `CC ${n}${known[n] ? ` (${known[n]})` : ''}`
}

const lastValue = new Map<string, number>()

/** Aplica un mensaje de control: aprender, ejecutar la acción asignada o pitch bend. */
export function handleControl(e: ControlEvent) {
  if (e.kind === 'bend') {
    const works = setBend(e.value * 2)
    set({ bend: e.value, bendWorks: works })
    return
  }
  const id = e.kind === 'cc' ? `cc:${e.cc}` : 'program'
  if (state.learning) {
    const mappings = Object.fromEntries(Object.entries(state.mappings).filter(([, a]) => a !== state.learning))
    set({ mappings: { ...mappings, [id]: state.learning }, learning: null })
    return
  }
  const action = state.mappings[id]
  if (!action) return
  const value = e.value
  if (ACTIONS[action].kind === 'continuo') {
    if (action === 'volumen') controls.setVolume(value / 127)
    if (action === 'modulacion') { setModulation(value / 127); set({ modulation: value / 127 }) }
    return
  }
  // Botones: solo al pulsar (flanco de subida). Los "program change" cuentan siempre como pulsación.
  const prev = lastValue.get(id) ?? 0
  lastValue.set(id, value)
  const pressed = e.kind === 'program' || (value >= 64 && prev < 64)
  if (!pressed) return
  const t = getTranspose()
  if (action === 'transponer+') controls.setTranspose(t + 1)
  if (action === 'transponer-') controls.setTranspose(t - 1)
  if (action === 'octava+') controls.setTranspose(t + 12)
  if (action === 'octava-') controls.setTranspose(t - 12)
  if (action === 'reiniciar') controls.setTranspose(0)
  if (action === 'siguiente') window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
}

let started = false
/** Se llama una vez al arrancar la app. */
export function startMidiControls() {
  if (started) return
  started = true
  subscribeControl(handleControl)
  if (state.volume < 1) setMasterVolume(state.volume)
}

export const useControls = () => useSyncExternalStore(controls.subscribe, controls.get)
