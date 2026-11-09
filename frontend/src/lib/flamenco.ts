// Notación y reproducción de rasgueos flamencos.
import { click, strum } from './audio'

export interface Stroke { f: string; dir: 'down' | 'up' | null; golpe: boolean }
export interface CompasBeat { index: number; count: number; accent: boolean; chord: string; strokes: Stroke[] }

/** Texto de un golpe como en los métodos: dedo + flecha, y «G» si lleva golpe en la tapa. */
export const strokeText = (s: Stroke) => `${s.f}${s.dir === 'up' ? '↑' : s.dir === 'down' ? '↓' : ''}${s.golpe ? '+G' : ''}`

/**
 * Momento de cada golpe dentro de un tiempo (en fracciones del tiempo, 0 = en el pulso).
 * - 2 golpes: corcheas (↓ en el pulso, ↑ a la mitad).
 * - 3 golpes: tresillo (el abanico).
 * - 4 o más con todos hacia abajo: redoble del rasgueo continuo, que termina JUSTO en
 *   el pulso: los primeros dedos salen un poco antes (valores negativos), así el
 *   índice marca el tiempo como hace el guitarrista.
 */
export function strokeOffsets(strokes: Stroke[], beatSec: number): number[] {
  const n = strokes.length
  if (n <= 1) return [0]
  if (n >= 4 && strokes.slice(0, 4).every((s) => s.dir === 'down')) {
    const gap = Math.min(0.045, beatSec / 8) // un redoble rápido pero que quepa a tempos altos
    return strokes.map((_, k) => (k <= 3 ? (k - 3) * gap : (k - 3) * Math.max(gap, beatSec / 4)) / beatSec)
  }
  return strokes.map((_, k) => k / n)
}

/** Programa un tiempo del compás (golpes y golpe en la tapa) a partir del instante t. */
export function scheduleBeat(beat: { accent: boolean; strokes: Stroke[] }, notes: number[], t: number, beatSec: number) {
  const offs = strokeOffsets(beat.strokes, beatSec)
  beat.strokes.forEach((s, k) => {
    const at = t + offs[k] * beatSec
    // Hacia arriba suenan las cuerdas agudas; el pulgar hacia abajo, todas.
    const ns = s.dir === 'up' ? notes.slice(-4) : notes
    const vel = (beat.accent && k === beat.strokes.length - 1) || s.golpe ? 0.85 : beat.accent ? 0.62 : 0.45
    if (s.dir) strum(ns, s.dir, s.f === 'p' ? 22 : 12, beatSec * 1.6, vel, at)
    if (s.golpe) click(true, at)
  })
}

/** El primer golpe puede caer antes del pulso (rasgueo continuo): margen para empezar. */
export const leadIn = (beats: { strokes: Stroke[] }[], beatSec: number) =>
  Math.max(0, ...beats.map((b) => -Math.min(...strokeOffsets(b.strokes, beatSec)) * beatSec))
