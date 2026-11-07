import { useRef } from 'react'
import { isBlack, pcName } from '../lib/music'

export type Mark = 'pressed' | 'held' | 'move' | 'target' | 'scale' | 'char' | 'root' | 'neg' | 'ghost'

interface Props {
  from?: number
  to?: number
  pressed?: Set<number>
  marks?: Record<number, Mark>
  labels?: Record<number, string>
  showNames?: boolean
  height?: number
  onDown?: (m: number) => void
  onUp?: (m: number) => void
}

const FILL: Partial<Record<Mark, string>> = {
  pressed: '#e8b04b', held: '#4fd1c5', move: '#ff7a6b', target: '#e8b04b', neg: '#a78bfa', ghost: 'rgba(232,176,75,0.35)',
}
const DOT: Partial<Record<Mark, string>> = { scale: '#7d7a74', char: '#ff7a6b', root: '#e8b04b' }

/** Teclado SVG escalable. Las marcas colorean teclas (llenas) o ponen un punto (escalas). */
export default function Piano({ from = 48, to = 84, pressed, marks = {}, labels = {}, showNames, height = 150, onDown, onUp }: Props) {
  const dragging = useRef(false)
  const last = useRef<number | null>(null)
  const whites: number[] = []
  for (let m = from; m <= to; m++) if (!isBlack(m)) whites.push(m)
  const W = 24
  const H = 120
  const BW = 14.5
  const BH = 76
  const width = whites.length * W
  const xOf = new Map<number, number>()
  whites.forEach((m, i) => xOf.set(m, i * W))

  const markOf = (m: number): Mark | undefined => (pressed?.has(m) ? 'pressed' : marks[m])

  const down = (m: number) => {
    dragging.current = true
    last.current = m
    onDown?.(m)
  }
  const enter = (m: number) => {
    if (!dragging.current || last.current === m) return
    if (last.current !== null) onUp?.(last.current)
    last.current = m
    onDown?.(m)
  }
  const up = () => {
    if (last.current !== null) onUp?.(last.current)
    dragging.current = false
    last.current = null
  }

  const keyEl = (m: number, black: boolean) => {
    const x = black ? (xOf.get(m - 1) ?? 0) + W - BW / 2 : xOf.get(m)!
    const mk = markOf(m)
    const fill = mk && FILL[mk]
    const dot = mk && DOT[mk]
    const w = black ? BW : W
    const h = black ? BH : H
    const label = labels[m] ?? (showNames && !black ? pcName(m) + (m % 12 === 0 ? Math.floor(m / 12) - 1 : '') : undefined)
    return (
      <g key={m} onPointerDown={(e) => { (e.target as Element).releasePointerCapture?.(e.pointerId); down(m) }}
         onPointerEnter={() => enter(m)}>
        <rect className={black ? 'bk' : 'wk'} x={x + 0.5} y={0} width={w - 1} height={h} rx={black ? 2.5 : 3.5}
              style={fill ? { fill } : undefined} />
        {fill && !black && <rect x={x + 3} y={h - 9} width={w - 6} height={4} rx={2} fill="rgba(0,0,0,0.18)" />}
        {dot && <circle cx={x + w / 2} cy={h - (black ? 12 : 16)} r={mk === 'scale' ? 3.2 : 4.6} fill={dot} />}
        {label && (
          <text x={x + w / 2} y={black ? h - 24 : h - 26} textAnchor="middle" fontSize={black ? 7.5 : 9}
                fontWeight={600} fill={black ? (fill ? '#14161d' : '#e9e4da') : '#2a2d36'}
                style={{ pointerEvents: 'none', fontFamily: 'var(--font)' }}>{label}</text>
        )}
      </g>
    )
  }

  const notes: number[] = []
  for (let m = from; m <= to; m++) notes.push(m)
  return (
    <div className="piano-wrap" onPointerUp={up} onPointerLeave={up}>
      <svg className="piano" viewBox={`0 0 ${width} ${H}`} width="100%" height={height} preserveAspectRatio="xMidYMin meet">
        {notes.filter((m) => !isBlack(m)).map((m) => keyEl(m, false))}
        {notes.filter((m) => isBlack(m)).map((m) => keyEl(m, true))}
      </svg>
    </div>
  )
}
