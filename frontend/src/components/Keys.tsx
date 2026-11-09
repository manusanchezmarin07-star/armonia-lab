import Piano, { type Mark } from './Piano'
import Fretboard, { type FretDot } from './Fretboard'
import { layout, positionsOf, intoRange } from '../lib/guitar'
import { useInstrument } from '../lib/instrument'

interface Props {
  from?: number; to?: number; pressed?: Set<number>; marks?: Record<number, Mark>; labels?: Record<number, string>
  fingers?: Record<number, number>; showNames?: boolean; height?: number
  onDown?: (m: number) => void; onUp?: (m: number) => void
}

const MAP_MARKS = new Set<Mark>(['scale', 'root', 'char'])
const BACKGROUND = new Set<Mark>(['ghost'])

/**
 * Instrumento de la pantalla: teclado de piano o mástil de guitarra según el modo.
 * Recibe las notas marcadas como si fuera un piano y, en guitarra, las coloca en
 * el mástil: las de escalas en todas sus posiciones; las de un acorde, en la
 * posición más compacta (una por cuerda).
 */
export default function Keys(props: Props) {
  const { isGuitar } = useInstrument()
  if (!isGuitar) return <Piano {...props} />
  const { marks = {}, pressed, labels = {}, showNames, height, onDown, onUp } = props
  const entries = Object.entries(marks).map(([m, k]) => [Number(m), k] as const)
  const dots: FretDot[] = []
  if (entries.some(([, k]) => MAP_MARKS.has(k))) {
    // Mapa de escala: cada clase de nota en todas sus casillas.
    const byPc = new Map<number, Mark>()
    const pcLabel = new Map<number, string>()
    entries.forEach(([m, k]) => {
      const pc = ((m % 12) + 12) % 12
      if (!byPc.has(pc) || k !== 'scale') byPc.set(pc, k)
      if (labels[m]) pcLabel.set(pc, labels[m])
    })
    for (let m = 40; m <= 79; m++) {
      const k = byPc.get(m % 12)
      if (!k) continue
      positionsOf(m).forEach((p) => dots.push({ ...p, mark: k, label: pcLabel.get(m % 12) }))
    }
  } else {
    const main = entries.filter(([, k]) => !BACKGROUND.has(k))
    const back = entries.filter(([, k]) => BACKGROUND.has(k))
    const placed = layout(main.map(([m]) => m))
    placed.forEach((p, i) => {
      const src = [...new Set(main.map(([m]) => intoRange(m)))].sort((a, b) => a - b)[i]
      const orig = main.find(([m]) => intoRange(m) === src)
      if (orig) dots.push({ ...p, mark: orig[1], label: labels[orig[0]] })
    })
    back.forEach(([m]) => {
      const p = positionsOf(intoRange(m)).sort((a, b) => a.fret - b.fret)[0]
      if (p && !dots.some((d) => d.string === p.string && d.fret === p.fret)) dots.push({ ...p, mark: 'ghost' })
    })
  }
  // Lo que se está tocando (MIDI, ratón o teclado): todas las notas juntas en la
  // posición más compacta, una por cuerda, como se pisarían a la vez en la guitarra.
  if (pressed?.size) {
    const notes = [...pressed]
    layout(notes).forEach((p) => {
      const i = dots.findIndex((d) => d.string === p.string && d.fret === p.fret)
      if (i >= 0) dots.splice(i, 1)
      dots.push({ ...p, mark: 'pressed' })
    })
  }
  return <Fretboard dots={dots} showNames={showNames} height={height ? Math.max(height, 150) : 190} onDown={onDown} onUp={onUp} />
}
