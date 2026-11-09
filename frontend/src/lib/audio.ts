import * as Tone from 'tone'

// Motor de audio con dos instrumentos: piano de cola Salamander (samples reales,
// CC-BY, los descarga el instalador) y guitarra de nailon (FluidR3, MIT, incluida
// en la app). Si las muestras no están, se usa un sintetizador para que la app
// nunca se quede muda.
const SAMPLE_NOTES = ['A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4',
  'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8']
const GUITAR_NOTES = ['E2', 'G2', 'As2', 'Cs3', 'E3', 'G3', 'As3', 'Cs4', 'E4', 'G4', 'As4', 'Cs5', 'E5', 'G5', 'As5', 'Cs6']

export type InstrumentKind = 'piano' | 'guitarra'
const SOURCES: Record<InstrumentKind, { base: string; notes: string[]; probe: string; release: number; reverb: number }> = {
  piano: { base: '/samples/salamander/', notes: SAMPLE_NOTES, probe: 'C4.mp3', release: 1.2, reverb: 0.12 },
  guitarra: { base: '/samples/guitar-nylon/', notes: GUITAR_NOTES, probe: 'E4.mp3', release: 0.9, reverb: 0.16 },
}

type Inst = { triggerAttack: Function; triggerRelease: Function; triggerAttackRelease: Function; releaseAll?: Function }

let kind: InstrumentKind = 'piano'
const loaded: Partial<Record<InstrumentKind, { inst: Inst; real: boolean }>> = {}
const loading: Partial<Record<InstrumentKind, Promise<{ inst: Inst; real: boolean }>>> = {}
let lastClick = 0
let clickHi: Tone.MembraneSynth | null = null
let clickLo: Tone.NoiseSynth | null = null

/** "piano" si suenan muestras reales del instrumento actual, "synth" si es el sintetizador de reserva. */
export const audioMode = () => (loaded[kind]?.real ? 'piano' : 'synth')
export const currentInstrument = () => kind

/** Cambia el instrumento que suena en toda la app (piano o guitarra). */
export function setInstrumentKind(k: InstrumentKind) {
  if (k === kind) return
  loaded[kind]?.inst.releaseAll?.()
  kind = k
  ensureAudio()
}

async function samplesAvailable(base: string, probe: string): Promise<boolean> {
  try {
    const r = await fetch(base + probe)
    return r.ok && (r.headers.get('content-type') || '').includes('audio')
  } catch {
    return false
  }
}

function makeSynth(): Inst {
  const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.18 }).toDestination()
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fattriangle', count: 2, spread: 12 } as any,
    envelope: { attack: 0.004, decay: 1.4, sustain: 0.12, release: 1.1 },
    volume: -12,
  }).connect(reverb)
  synth.maxPolyphony = 64
  return synth as unknown as Inst
}

// ---------------------------------------------------------------------------
// Desbloqueo del audio. Los navegadores mantienen el AudioContext en pausa hasta
// un gesto del usuario (clic, tecla, toque). Una nota MIDI NO cuenta como gesto,
// así que si lo primero que haces es tocar el teclado MIDI el audio no arranca.
// Por eso: (1) se intenta reanudar en cada gesto hasta conseguirlo y (2) se avisa
// en pantalla mientras siga bloqueado. Nunca se espera (await) a Tone.start()
// fuera de un gesto: esa promesa no se resuelve hasta que hay uno.
// ---------------------------------------------------------------------------
const listeners = new Set<(running: boolean) => void>()
export const audioRunning = () => Tone.getContext().state === 'running'

/** Reanuda el audio. Llamar desde un manejador de clic o tecla. */
export function unlockAudio() {
  if (!audioRunning()) Tone.start().catch(() => {})
  ensureAudio()
}

/** Suscribe a los cambios de estado del audio (bloqueado / sonando). */
export function onAudioState(fn: (running: boolean) => void) {
  listeners.add(fn)
  fn(audioRunning())
  return () => { listeners.delete(fn) }
}

if (typeof window !== 'undefined') {
  Tone.getContext().rawContext.addEventListener('statechange', () => listeners.forEach((l) => l(audioRunning())))
  const gesture = () => {
    unlockAudio()
    if (audioRunning()) ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, gesture, true))
  }
  ;['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, gesture, true))
}

/** Prepara el instrumento actual (muestras reales o sintetizador). No requiere gesto. */
export async function ensureAudio(): Promise<Inst> {
  const k = kind
  if (loaded[k]) return loaded[k]!.inst
  if (!loading[k]) {
    loading[k] = (async () => {
      const src = SOURCES[k]
      let entry: { inst: Inst; real: boolean }
      if (await samplesAvailable(src.base, src.probe)) {
        const urls: Record<string, string> = {}
        src.notes.forEach((n) => (urls[n.replace('s', '#')] = `${n}.mp3`))
        const reverb = new Tone.Reverb({ decay: 2.5, wet: src.reverb }).toDestination()
        const sampler = await new Promise<Tone.Sampler>((resolve) => {
          const s: Tone.Sampler = new Tone.Sampler({ urls, baseUrl: src.base, release: src.release,
            onload: () => resolve(s) }).connect(reverb)
        })
        entry = { inst: sampler as unknown as Inst, real: true }
      } else {
        entry = { inst: makeSynth(), real: false }
      }
      loaded[k] = entry
      return entry
    })()
  }
  return (await loading[k]!).inst
}

/**
 * Rasgueo: las notas de un acorde suenan escalonadas, como al pasar la mano por las
 * cuerdas. Hacia abajo (de la 6ª a la 1ª) empieza por la grave; hacia arriba, por la aguda.
 */
export async function strum(notes: number[], direction: 'down' | 'up' = 'down', spreadMs = 18, dur = 1.8, velocity = 0.75, time?: number) {
  const i = await ensureAudio()
  const order = [...notes].sort((a, b) => a - b)
  if (direction === 'up') order.reverse()
  const t0 = time ?? Tone.now() + 0.02
  order.forEach((n, k) => i.triggerAttackRelease(freq(n), dur, t0 + (k * spreadMs) / 1000, velocity * (direction === 'up' ? 0.85 : 1)))
}

const freq = (m: number) => Tone.Frequency(m, 'midi').toFrequency()

// Notas en directo con Tone.immediate() y no Tone.now(): now() añade el "lookAhead"
// de 0,1 s pensado para secuencias programadas, que se nota mucho al tocar
// (y más con auriculares Bluetooth, que ya tienen su propia latencia).
export async function noteOn(midi: number, velocity = 0.8) {
  const i = await ensureAudio()
  i.triggerAttack(freq(midi), Tone.immediate(), velocity)
}
export async function noteOff(midi: number) {
  const i = await ensureAudio()
  i.triggerRelease(freq(midi), Tone.immediate())
}

export async function playChord(notes: number[], dur = 1.6, arpeggio = 0.0, velocity = 0.7) {
  const i = await ensureAudio()
  const t = Tone.now() + 0.02
  notes.forEach((n, k) => i.triggerAttackRelease(freq(n), dur, t + k * arpeggio, velocity))
}

let seqTimers: number[] = []
export function stopSequence() {
  seqTimers.forEach(clearTimeout)
  seqTimers = []
  loaded[kind]?.inst.releaseAll?.()
}

/** Toca una secuencia de acordes llamando a onStep para sincronizar la animación. */
export async function playSequence(chords: number[][], stepSec: number, onStep?: (i: number) => void, onEnd?: () => void) {
  stopSequence()
  await ensureAudio()
  chords.forEach((notes, i) => {
    seqTimers.push(window.setTimeout(() => {
      onStep?.(i)
      playChord(notes, stepSec * 0.95)
    }, i * stepSec * 1000))
  })
  seqTimers.push(window.setTimeout(() => onEnd?.(), chords.length * stepSec * 1000))
}

/** Golpe de palma/metrónomo: acentuado más fuerte y agudo. */
export async function click(accent: boolean, time?: number) {
  if (!audioRunning()) Tone.start().catch(() => {})
  let t = time ?? Tone.now()
  // Los sintes de percusión son monofónicos y exigen tiempos crecientes:
  // - mismo instante (una palma y el golpe en la tapa): se separa 1 ms;
  // - un tiempo ANTERIOR a lo ya programado es una secuencia nueva (se paró y se volvió
  //   a tocar): se crean sintes nuevos, que además cortan los golpes viejos pendientes.
  if (clickHi && t < lastClick - 0.002) { clickHi.dispose(); clickLo?.dispose(); clickHi = null }
  else if (t <= lastClick) t = lastClick + 0.001
  if (!clickHi) {
    clickHi = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).toDestination()
    clickLo = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: -10 }).toDestination()
  }
  lastClick = t
  if (accent) {
    clickHi.triggerAttackRelease('C5', '32n', t, 0.9)
    clickLo!.triggerAttackRelease('32n', t, 1)
  } else {
    clickLo!.triggerAttackRelease('32n', t, 0.35)
  }
}

export { Tone }

/** Un voicing del backend ({bass, upper}) como lista de notas MIDI. */
export const voicingNotes = (v: { bass: number; upper: number[] }) => [v.bass, ...v.upper]


// ---------------------------------------------------------------------------
// Controles en directo (fader de volumen, rueda de modulación, pitch bend).
// ---------------------------------------------------------------------------
let vibrato: Tone.Vibrato | null = null

/** Volumen general 0…1 (fader del teclado o deslizador de la app). */
export function setMasterVolume(v: number) {
  const db = v <= 0.001 ? -Infinity : 20 * Math.log10(v)
  Tone.getDestination().volume.rampTo(db, 0.05)
}

/** Rueda de modulación 0…1 → vibrato. Con 0 el efecto queda sin mezcla (no colorea el sonido). */
export function setModulation(v: number) {
  if (!vibrato) {
    vibrato = new Tone.Vibrato({ frequency: 5.5, depth: 0, wet: 0 })
    Tone.getDestination().chain(vibrato)
  }
  vibrato.depth.rampTo(Math.min(1, v) * 0.35, 0.05)
  vibrato.wet.rampTo(v > 0.01 ? 1 : 0, 0.05)
}

/**
 * Pitch bend en semitonos. Solo funciona con el sintetizador: con muestras reales
 * (piano o guitarra) no se dobla la afinación, igual que en un piano real.
 */
export function setBend(semitones: number): boolean {
  const cur = loaded[kind]
  if (!cur || cur.real) return false
  ;(cur.inst as unknown as Tone.PolySynth).set({ detune: semitones * 100 })
  return true
}
