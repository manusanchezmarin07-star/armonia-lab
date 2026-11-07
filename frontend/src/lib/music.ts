// Utilidades de notas en el cliente (la teoría "seria" vive en el backend).
export const PC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
export const BLACK = new Set([1, 3, 6, 8, 10])

export const isBlack = (midi: number) => BLACK.has(((midi % 12) + 12) % 12)
export const pcName = (pc: number) => PC_NAMES[((pc % 12) + 12) % 12]
export const midiName = (m: number) => `${pcName(m)}${Math.floor(m / 12) - 1}`

/** Las 24 tonalidades con el deletreo más habitual (Gb y F# se ofrecen ambas). */
export const KEYS = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm',
]
export const keyLabel = (k: string) => (k.endsWith('m') ? `${k.slice(0, -1)} menor` : `${k} mayor`)

export const TONICS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

/** Color por función tonal (T/S/D), coherente en toda la app. */
export const fnColor = (fn?: string | null) =>
  fn === 'T' ? 'var(--fn-t)' : fn === 'S' ? 'var(--fn-s)' : fn === 'D' ? 'var(--fn-d)' : 'var(--violet)'

/** Pitch class de la tónica de una tonalidad escrita como 'Eb' o 'F#m'. */
export function keyPc(k: string) {
  const name = k.endsWith('m') ? k.slice(0, -1) : k
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  let pc = base[name[0]] ?? 0
  if (name.includes('#')) pc += 1
  if (name.includes('b')) pc -= 1
  return (pc + 12) % 12
}

export const ARTISTS = ['Jacob Collier', 'J. S. Bach', 'Vicente Marín Trío', 'Emily Bear', 'Otro']
