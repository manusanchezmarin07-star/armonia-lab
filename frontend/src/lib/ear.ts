// Definición de los ejercicios de oído. Todo se genera en el cliente: son
// combinaciones de intervalos fijos, sin teoría que pueda fallar.

export interface EarItem {
  id: string
  label: string
  /** Notas relativas a la fundamental/tónica (semitonos). Para progresiones, una lista por acorde. */
  shape: number[] | number[][]
}

export interface EarMode {
  id: string
  name: string
  description: string
  items: EarItem[]
  /** Cómo se reproduce: notas sucesivas, acorde o progresión. */
  kind: 'interval' | 'chord' | 'degree' | 'progression'
  /** Se puede responder tocando en el MIDI. */
  midiAnswer: boolean
}

export const INTERVALS: EarItem[] = [
  ['2m', '2ª menor', 1], ['2M', '2ª mayor', 2], ['3m', '3ª menor', 3], ['3M', '3ª mayor', 4], ['4J', '4ª justa', 5],
  ['TT', 'Tritono', 6], ['5J', '5ª justa', 7], ['6m', '6ª menor', 8], ['6M', '6ª mayor', 9], ['7m', '7ª menor', 10],
  ['7M', '7ª mayor', 11], ['8', 'Octava', 12],
].map(([id, label, s]) => ({ id: id as string, label: label as string, shape: [0, s as number] }))

export const CHORD_QUALITIES: EarItem[] = [
  ['maj', 'Mayor', [0, 4, 7]], ['min', 'Menor', [0, 3, 7]], ['dim', 'Disminuido', [0, 3, 6]], ['aug', 'Aumentado', [0, 4, 8]],
  ['sus4', 'Sus4', [0, 5, 7]], ['7', 'Dominante 7', [0, 4, 7, 10]], ['maj7', 'Maj7', [0, 4, 7, 11]], ['m7', 'm7', [0, 3, 7, 10]],
  ['m7b5', 'Semidisminuido', [0, 3, 6, 10]], ['dim7', 'Disminuido 7', [0, 3, 6, 9]], ['mmaj7', 'm(maj7)', [0, 3, 7, 11]],
].map(([id, label, s]) => ({ id: id as string, label: label as string, shape: s as number[] }))

// Grados de la escala mayor como acordes (tríadas), para reconocer funciones dentro de una tonalidad.
export const DEGREES: EarItem[] = [
  ['I', 'I', [0, 4, 7]], ['ii', 'ii', [2, 5, 9]], ['iii', 'iii', [4, 7, 11]], ['IV', 'IV', [5, 9, 12]],
  ['V', 'V', [7, 11, 14]], ['vi', 'vi', [9, 12, 16]], ['vii', 'vii°', [11, 14, 17]],
  ['bVII', 'bVII (préstamo)', [10, 14, 17]], ['iv', 'iv (préstamo)', [5, 8, 12]], ['bVI', 'bVI (préstamo)', [8, 12, 15]],
].map(([id, label, s]) => ({ id: id as string, label: label as string, shape: s as number[] }))

const T = (...chords: number[][]) => chords
const I = [0, 4, 7], IV = [5, 9, 12], V = [7, 11, 14], vi = [9, 12, 16], V7 = [7, 11, 14, 17]
const bVII = [10, 14, 17], iv = [5, 8, 12], ii7 = [2, 5, 9, 12], Imaj7 = [0, 4, 7, 11], bVI = [8, 12, 15]
export const PROGRESSIONS: EarItem[] = [
  { id: 'pop', label: 'I – V – vi – IV', shape: T(I, V, vi, IV) },
  { id: '50s', label: 'I – vi – IV – V', shape: T(I, vi, IV, V) },
  { id: '251', label: 'ii – V – I', shape: T(ii7, V7, Imaj7) },
  { id: 'blues', label: 'I – IV – I – V', shape: T(I, IV, I, V) },
  { id: 'axis2', label: 'vi – IV – I – V', shape: T(vi, IV, I, V) },
  { id: 'mixo', label: 'I – bVII – IV – I', shape: T(I, bVII, IV, I) },
  { id: 'plagal', label: 'I – IV – iv – I', shape: T(I, IV, iv, I) },
  { id: 'epic', label: 'I – bVI – bVII – I', shape: T(I, bVI, bVII, I) },
]

export const MODES: EarMode[] = [
  { id: 'intervalos', name: 'Intervalos', kind: 'interval', items: INTERVALS, midiAnswer: true,
    description: 'Dos notas seguidas. ¿Qué distancia hay? Puedes responder tocando las dos notas en el teclado.' },
  { id: 'acordes', name: 'Tipos de acorde', kind: 'chord', items: CHORD_QUALITIES, midiAnswer: true,
    description: 'Un acorde suelto. ¿Qué tipo es? Puedes responder tocando ese tipo de acorde con cualquier fundamental.' },
  { id: 'grados', name: 'Grados en la tonalidad', kind: 'degree', items: DEGREES, midiAnswer: true,
    description: 'Primero suena una cadencia (I–IV–V–I) para fijar la tonalidad y después un acorde. ¿Qué grado es?' },
  { id: 'progresiones', name: 'Progresiones', kind: 'progression', items: PROGRESSIONS, midiAnswer: false,
    description: 'Progresiones que aparecen en miles de canciones. ¿Cuál suena?' },
]

/** Elige un elemento dando más peso a los que más fallas (repetición adaptativa). */
export function pickWeighted(items: EarItem[], stats: Record<string, { ok: number; ko: number }>, avoid?: string) {
  const weights = items.map((it) => {
    const s = stats[it.id] ?? { ok: 0, ko: 0 }
    const w = 1 + (s.ko * 2) / (1 + s.ok)
    return it.id === avoid && items.length > 1 ? 0 : w
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** Comprueba una respuesta tocada en el MIDI comparando formas (intervalos) sin importar la octava. */
export function matchesShape(played: number[], item: EarItem, kind: EarMode['kind'], tonic: number): boolean {
  if (played.length < 2) return false
  const pcs = new Set(played.map((m) => ((m % 12) + 12) % 12))
  const shape = item.shape as number[]
  if (kind === 'interval') {
    const sorted = [...played].sort((a, b) => a - b)
    const dist = sorted[sorted.length - 1] - sorted[0]
    return dist === shape[1] || (shape[1] !== 12 && dist % 12 === shape[1] % 12 && dist > 12)
  }
  if (kind === 'degree') {
    const target = new Set(shape.map((s) => (tonic + s) % 12))
    return pcs.size === target.size && [...target].every((p) => pcs.has(p))
  }
  // Tipo de acorde: vale cualquier fundamental, así que se prueba cada nota tocada como raíz.
  const target = shape.map((s) => s % 12)
  return [...pcs].some((root) => {
    const rel = new Set([...pcs].map((p) => (p - root + 12) % 12))
    return rel.size === target.length && target.every((t) => rel.has(t))
  })
}
