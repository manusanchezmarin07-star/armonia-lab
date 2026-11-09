// Patrones de mano derecha para guitarra clásica/española.
// p = pulgar (bajos), i = índice, m = medio, a = anular, como en los métodos de guitarra.
import type { Shape } from './guitar'

export interface Stroke { notes: number[]; label: string; strum?: 'down' | 'up' }

export const GUITAR_PATTERNS: Record<string, string> = {
  rasgueo: 'Rasgueo hacia abajo (↓ ↓ ↓ ↓)',
  'abajo-arriba': 'Rasgueo ↓ ↓ ↑ ↑ ↓ ↑ (pop/folk)',
  pima: 'Arpegio p-i-m-a',
  pimami: 'Arpegio p-i-m-a-m-i',
  pami: 'Arpegio p-a-m-i',
  'p-im-a': 'Pulgar y pinza (p · i+m · a)',
  bloque: 'Plaqué (todas a la vez con p-i-m-a)',
}

/** Notas de la posición por cuerda (6ª → 1ª), solo las que suenan. */
function byString(shape: Shape) {
  return [...shape.notes].sort((a, b) => b.string - a.string) // 6ª primero
}

/**
 * Golpes de un patrón para una posición concreta. El pulgar toca el bajo (la cuerda
 * más grave que suena); i, m y a, las tres cuerdas agudas que suenan (3ª, 2ª y 1ª
 * normalmente), que es la colocación básica de la mano derecha.
 */
export function guitarStrokes(shape: Shape, pattern: string): Stroke[] {
  const ns = byString(shape)
  if (!ns.length) return []
  const all = ns.map((n) => n.midi)
  const p = ns[0].midi
  const trebles = ns.slice(-3).map((n) => n.midi) // [i, m, a] de grave a agudo
  const [i, m, a] = [trebles[0], trebles[1] ?? trebles[0], trebles[2] ?? trebles[trebles.length - 1]]
  switch (pattern) {
    case 'rasgueo': return Array.from({ length: 4 }, () => ({ notes: all, label: '↓', strum: 'down' as const }))
    case 'abajo-arriba': return (['down', 'down', 'up', 'up', 'down', 'up'] as const).map((d) => ({ notes: d === 'up' ? all.slice(-4) : all, label: d === 'down' ? '↓' : '↑', strum: d }))
    case 'pima': return [{ notes: [p], label: 'p' }, { notes: [i], label: 'i' }, { notes: [m], label: 'm' }, { notes: [a], label: 'a' }]
    case 'pimami': return [{ notes: [p], label: 'p' }, { notes: [i], label: 'i' }, { notes: [m], label: 'm' }, { notes: [a], label: 'a' }, { notes: [m], label: 'm' }, { notes: [i], label: 'i' }]
    case 'pami': return [{ notes: [p], label: 'p' }, { notes: [a], label: 'a' }, { notes: [m], label: 'm' }, { notes: [i], label: 'i' }]
    case 'p-im-a': return [{ notes: [p], label: 'p' }, { notes: [i, m], label: 'i+m' }, { notes: [a], label: 'a' }, { notes: [i, m], label: 'i+m' }]
    default: return [{ notes: [p, i, m, a].filter((x, k, arr) => arr.indexOf(x) === k), label: 'p+i+m+a' }]
  }
}

export const FINGER_NAMES_LH = ['al aire', 'índice', 'medio', 'anular', 'meñique']

/**
 * Lleva cada nota tocada a la nota objetivo de la misma clase más cercana. Así se
 * puede practicar el acorde de guitarra con un teclado MIDI: el Do que tocas en el
 * piano cuenta como el Do de la 5ª cuerda aunque esté en otra octava.
 */
export function snapToTargets<T extends { note: number }>(take: T[], targets: number[]): T[] {
  return take.map((t) => {
    const same = targets.filter((m) => (m - t.note) % 12 === 0)
    if (!same.length) return t
    const best = same.reduce((a, b) => (Math.abs(b - t.note) < Math.abs(a - t.note) ? b : a))
    return { ...t, note: best }
  })
}

const FRET_WORD = (f: number) => (f === 0 ? 'al aire' : `traste ${f}`)

export interface GuitarStep { title: string; text: string; notes: number[] }

/**
 * Pasos para montar una posición: primero la cejilla (si hay), luego cada dedo del
 * más grave al más agudo (así la mano no tapa lo que ya está puesto), y al final las
 * cuerdas que no se tocan y el rasgueo completo.
 */
export function guitarSteps(shape: Shape): GuitarStep[] {
  const steps: GuitarStep[] = []
  const notes = [...shape.notes].sort((a, b) => b.string - a.string)
  if (shape.barre) {
    const covered = notes.filter((n) => n.fret === shape.barre!.fret && n.finger === 1)
    steps.push({
      title: `Cejilla con el índice en el traste ${shape.barre.fret}`,
      text: `Apoya el dedo 1 plano de la ${shape.barre.from_string}ª a la ${shape.barre.to_string}ª cuerda, pegado al traste y con el pulgar detrás del mástil a la altura del dedo 2.`,
      notes: covered.map((n) => n.midi),
    })
  }
  notes.filter((n) => n.fret > 0 && !(shape.barre && n.finger === 1 && n.fret === shape.barre.fret)).forEach((n) => {
    steps.push({
      title: `Dedo ${n.finger} (${FINGER_NAMES_LH[n.finger] ?? ''}): ${n.string}ª cuerda, ${FRET_WORD(n.fret)}`,
      text: `Suena ${n.note} (${n.role}). Usa la yema, justo detrás del traste, con el dedo arqueado para no rozar las cuerdas de al lado.`,
      notes: [n.midi],
    })
  })
  const muted = shape.frets.map((f, i) => (f < 0 ? 6 - i : 0)).filter(Boolean)
  const open = notes.filter((n) => n.fret === 0).map((n) => `${n.string}ª`)
  const low = notes[0]
  steps.push({
    title: 'Toca el acorde entero',
    text: [
      `Empieza en la ${low.string}ª cuerda (${low.note}, el bajo).`,
      open.length ? `Deja sonar al aire: ${open.join(', ')}.` : '',
      muted.length ? `No toques la ${muted.join('ª, ')}ª: apágala rozándola con el pulgar o con la punta del dedo vecino.` : '',
    ].filter(Boolean).join(' '),
    notes: notes.map((n) => n.midi),
  })
  return steps
}
