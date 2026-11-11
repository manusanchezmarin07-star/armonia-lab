import { useRef } from 'react'
import Piano, { type Mark } from './Piano'
import Fretboard, { type FretDot } from './Fretboard'
import { layout, positionsOf, intoRange, type Pos } from '../lib/guitar'
import { useGuitarVoicing } from '../lib/guitarVoicing'
import { useInstrument } from '../lib/instrument'
import { pcName } from '../lib/music'

interface Props {
  from?: number; to?: number; pressed?: Set<number>; marks?: Record<number, Mark>; labels?: Record<number, string>
  fingers?: Record<number, number>; showNames?: boolean; height?: number
  onDown?: (m: number) => void; onUp?: (m: number) => void
}

const MAP_MARKS = new Set<Mark>(['scale', 'root', 'char'])
const BACKGROUND = new Set<Mark>(['ghost'])
// Si dos notas de la misma clase llevan marcas distintas, manda la más informativa.
const PRIORITY: Mark[] = ['wrong', 'move', 'neg', 'held', 'target', 'lh', 'rh', 'lh-todo', 'rh-todo', 'pressed']

/**
 * Instrumento de la pantalla: teclado de piano o mástil de guitarra según el modo.
 * Recibe las notas marcadas como si fuera un piano. En guitarra:
 *  - las de una escala se dibujan en todas sus casillas (mapa del mástil);
 *  - las de un acorde, con la posición de guitarra con que se toca de verdad (no con
 *    las octavas exactas del piano, que en el mástil quedan en sitios imposibles),
 *    coloreando cada nota como en el teclado;
 *  - lo que se está pulsando, donde se ha pulsado.
 */
export default function Keys(props: Props) {
  const { isGuitar } = useInstrument()
  // Casilla exacta de cada nota pulsada en el mástil: la misma nota existe en varias
  // cuerdas y el punto debe salir donde se hizo clic, no en otra cuerda.
  const clicked = useRef<Map<number, Pos>>(new Map())
  const { marks = {}, pressed, labels = {}, showNames, height, onDown, onUp } = props
  const entries = Object.entries(marks).map(([m, k]) => [Number(m), k] as const)
  const isMap = entries.some(([, k]) => MAP_MARKS.has(k))
  const main = entries.filter(([, k]) => !BACKGROUND.has(k) && !MAP_MARKS.has(k))
  const shape = useGuitarVoicing(main.map(([m]) => m), isGuitar && !isMap && main.length >= 3)
  if (!isGuitar) return <Piano {...props} />

  const dots: FretDot[] = []
  let muted: number[] = []
  if (isMap) {
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
  } else if (shape) {
    // Acorde reconocido: su posición de guitarra, con el color que cada nota tenía en el teclado.
    const markOfPc = new Map<number, Mark>()
    main.forEach(([m, k]) => {
      const pc = ((m % 12) + 12) % 12
      const cur = markOfPc.get(pc)
      if (!cur || PRIORITY.indexOf(k) < PRIORITY.indexOf(cur)) markOfPc.set(pc, k)
    })
    shape.notes.forEach((n) => dots.push({ string: n.string, fret: n.fret, mark: markOfPc.get(n.midi % 12) ?? 'target', label: pcName(n.midi) }))
    muted = shape.frets.map((f, i) => (f < 0 ? 6 - i : 0)).filter(Boolean)
  } else {
    // Notas sueltas o que no forman acorde: tal cual, en la zona más cómoda del mástil.
    const placed = layout(main.map(([m]) => m))
    const sorted = [...new Set(main.map(([m]) => intoRange(m)))].sort((a, b) => a - b)
    placed.forEach((p, i) => {
      const orig = main.find(([m]) => intoRange(m) === sorted[i])
      if (orig) dots.push({ ...p, mark: orig[1], label: labels[orig[0]] })
    })
    entries.filter(([, k]) => BACKGROUND.has(k)).forEach(([m]) => {
      const p = positionsOf(intoRange(m)).sort((a, b) => a.fret - b.fret)[0]
      if (p && !dots.some((d) => d.string === p.string && d.fret === p.fret)) dots.push({ ...p, mark: 'ghost' })
    })
  }
  // Lo que se está tocando: lo pulsado en el mástil, en su casilla; lo que llega del MIDI
  // o del teclado, junto en la posición más compacta (una nota por cuerda).
  if (pressed?.size) {
    for (const m of clicked.current.keys()) if (!pressed.has(m)) clicked.current.delete(m)
    const put = (p: Pos) => {
      const i = dots.findIndex((d) => d.string === p.string && d.fret === p.fret)
      if (i >= 0) dots.splice(i, 1)
      dots.push({ ...p, mark: 'pressed' })
    }
    const free: number[] = []
    pressed.forEach((m) => { const p = clicked.current.get(m); if (p) put(p); else free.push(m) })
    layout(free).forEach(put)
  }
  return (
    <Fretboard dots={dots} muted={muted} showNames={showNames && !shape} full={isMap} height={height ? Math.max(height, 150) : 180}
               onDown={onDown && ((m, pos) => { clicked.current.set(m, pos); onDown(m) })} onUp={onUp} />
  )
}
