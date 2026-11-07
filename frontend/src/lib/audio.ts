import * as Tone from 'tone'

// Motor de audio. Se intenta cargar el piano de cola Salamander (samples reales,
// licencia CC-BY) desde /samples/salamander; el instalador los descarga. Si no
// están, se usa un sintetizador con envolvente de piano para que la app nunca se
// quede muda.
const SAMPLE_NOTES = ['A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4',
  'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8']

type Inst = { triggerAttack: Function; triggerRelease: Function; triggerAttackRelease: Function; releaseAll?: Function }

let instrument: Inst | null = null
let loading: Promise<Inst> | null = null
let mode: 'piano' | 'synth' = 'synth'
let clickHi: Tone.MembraneSynth | null = null
let clickLo: Tone.NoiseSynth | null = null

export const audioMode = () => mode

async function samplesAvailable(): Promise<boolean> {
  try {
    const r = await fetch('/samples/salamander/C4.mp3')
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

/** Inicializa el audio (debe llamarse tras un gesto del usuario por política del navegador). */
export async function ensureAudio(): Promise<Inst> {
  if (instrument) return instrument
  if (loading) return loading
  loading = (async () => {
    await Tone.start()
    if (await samplesAvailable()) {
      const urls: Record<string, string> = {}
      SAMPLE_NOTES.forEach((n) => (urls[n.replace('s', '#')] = `${n}.mp3`))
      const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.12 }).toDestination()
      const sampler = await new Promise<Tone.Sampler>((resolve) => {
        const s: Tone.Sampler = new Tone.Sampler({ urls, baseUrl: '/samples/salamander/', release: 1.2,
          onload: () => resolve(s) }).connect(reverb)
      })
      mode = 'piano'
      instrument = sampler as unknown as Inst
    } else {
      instrument = makeSynth()
    }
    return instrument
  })()
  return loading
}

const freq = (m: number) => Tone.Frequency(m, 'midi').toFrequency()

export async function noteOn(midi: number, velocity = 0.8) {
  const i = await ensureAudio()
  i.triggerAttack(freq(midi), Tone.now(), velocity)
}
export async function noteOff(midi: number) {
  const i = await ensureAudio()
  i.triggerRelease(freq(midi), Tone.now())
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
  instrument?.releaseAll?.()
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
  await Tone.start()
  if (!clickHi) {
    clickHi = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).toDestination()
    clickLo = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: -10 }).toDestination()
  }
  const t = time ?? Tone.now()
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
