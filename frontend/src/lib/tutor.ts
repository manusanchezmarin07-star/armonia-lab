// Lógica pura del tutor de acordes: patrones de arpegio y evaluación de lo tocado.
import type { RecordedNote } from './recorder'

export interface HandNote { midi: number; note: string; finger: number; role: string }
export interface HandsData {
  symbol: string; style: string; style_description: string; inversion: string
  left: HandNote[]; right: HandNote[]; notes: number[]; spell: Record<string, string>
  steps: { hand: 'left' | 'right' | 'both'; title: string; text: string; notes: number[] }[]
}

export const PATTERNS: Record<string, string> = {
  bloque: 'Bloque (todas a la vez)',
  subir: 'Arpegio ascendente',
  bajar: 'Arpegio descendente',
  'subir-bajar': 'Sube y baja',
  alberti: 'Bajo de Alberti (izq. fija, der. grave-aguda-media-aguda)',
  vals: 'Vals / stride (bajo – acorde – 5ª – acorde)',
}

/** Secuencia de golpes (cada uno, notas simultáneas) para un patrón. */
export function patternSteps(lh: number[], rh: number[], pattern: string): number[][] {
  const all = [...lh, ...rh].sort((a, b) => a - b)
  switch (pattern) {
    case 'subir': return all.map((n) => [n])
    case 'bajar': return [...all].reverse().map((n) => [n])
    case 'subir-bajar': return [...all, ...[...all].reverse().slice(1)].map((n) => [n])
    case 'alberti': {
      const r = [...rh].sort((a, b) => a - b)
      const lo = r[0], hi = r[r.length - 1], mid = r[Math.floor(r.length / 2)] ?? hi
      return [[...lh, lo], [hi], [mid], [hi], [lo], [hi], [mid], [hi]]
    }
    case 'vals': {
      const bass = lh[0] ?? all[0]
      const fifth = lh[1] ?? bass + 7
      return [[bass], rh, rh, [fifth], rh, rh]
    }
    default: return [all]
  }
}

export interface TakeReport {
  correct: number[]; missing: number[]; extra: number[]
  spreadMs: number | null; evenness: number | null; orderOk: boolean | null
  score: number; messages: string[]
}

const name = (m: number) => ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'][m % 12] + (Math.floor(m / 12) - 1)

/**
 * Compara una toma con el objetivo. En bloque mide la simultaneidad (cuánto
 * tardan en entrar todas las notas); en arpegio, el orden y la regularidad.
 * Las notas se comparan por altura exacta: la posición en el piano importa.
 */
export function evaluateTake(take: RecordedNote[], steps: number[][], pattern: string): TakeReport {
  const target = [...new Set(steps.flat())]
  const played = [...new Set(take.map((n) => n.note))]
  const correct = target.filter((n) => played.includes(n))
  const missing = target.filter((n) => !played.includes(n))
  const extra = played.filter((n) => !target.includes(n))
  const messages: string[] = []
  let spreadMs: number | null = null
  let evenness: number | null = null
  let orderOk: boolean | null = null

  if (!take.length) {
    return { correct, missing, extra, spreadMs, evenness, orderOk, score: 0, messages: ['No se ha grabado ninguna nota.'] }
  }
  if (pattern === 'bloque') {
    const firsts = target.map((n) => take.find((t) => t.note === n)?.start).filter((x): x is number => x !== undefined)
    if (firsts.length > 1) {
      spreadMs = Math.round(Math.max(...firsts) - Math.min(...firsts))
      messages.push(spreadMs <= 40 ? `Muy junto: todas las notas entraron en ${spreadMs} ms.`
        : spreadMs <= 90 ? `Bastante junto (${spreadMs} ms). Intenta dejar caer la mano entera a la vez.`
          : `Las notas entraron escalonadas (${spreadMs} ms). Prepara los dedos sobre las teclas antes de tocar.`)
    }
  } else {
    const seq = steps.map((s) => s[s.length - 1])
    const onsets = take.map((t) => t.note)
    // Orden: la secuencia objetivo debe aparecer como subsecuencia de lo tocado.
    let i = 0
    onsets.forEach((n) => { if (i < seq.length && n === seq[i]) i++ })
    orderOk = i === seq.length
    messages.push(orderOk ? 'Orden correcto.' : `El orden no coincide: llegaste bien hasta el golpe ${i} de ${seq.length}.`)
    const starts = take.map((t) => t.start)
    if (starts.length >= 3) {
      const iois = starts.slice(1).map((t, k) => t - starts[k]).filter((x) => x > 25)
      if (iois.length >= 2) {
        const mean = iois.reduce((a, b) => a + b, 0) / iois.length
        const sd = Math.sqrt(iois.reduce((a, b) => a + (b - mean) ** 2, 0) / iois.length)
        evenness = Math.round((sd / mean) * 100)
        messages.push(evenness <= 15 ? `Muy regular (variación del ${evenness} %).`
          : `Irregular (variación del ${evenness} %). Practica con el metrónomo más lento.`)
      }
    }
  }
  if (missing.length) messages.push(`Faltaron: ${missing.map(name).join(', ')}.`)
  if (extra.length) messages.push(`Sobraron: ${extra.map(name).join(', ')}.`)
  if (!missing.length && !extra.length) messages.unshift('¡Todas las notas correctas!')
  const accuracy = target.length ? correct.length / (target.length + extra.length) : 0
  const timing = pattern === 'bloque' ? (spreadMs === null ? 1 : Math.max(0, 1 - Math.max(0, spreadMs - 40) / 200))
    : ((orderOk ? 1 : 0.5) * (evenness === null ? 1 : Math.max(0, 1 - Math.max(0, evenness - 15) / 60)))
  return { correct, missing, extra, spreadMs, evenness, orderOk, score: Math.round(accuracy * timing * 100), messages }
}
