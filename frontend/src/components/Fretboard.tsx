import { useRef } from 'react'
import { MAX_FRET, TUNING, midiAt } from '../lib/guitar'
import { pcName } from '../lib/music'

export type FretMark = 'pressed' | 'held' | 'move' | 'target' | 'scale' | 'char' | 'root' | 'neg' | 'ghost' | 'lh' | 'rh' | 'lh-todo' | 'rh-todo' | 'wrong'

export interface FretDot { string: number; fret: number; mark: FretMark; label?: string }

const FILL: Partial<Record<FretMark, string>> = {
  pressed: '#e8b04b', held: '#4fd1c5', move: '#ff7a6b', target: '#e8b04b', neg: '#a78bfa', ghost: 'rgba(232,176,75,0.4)',
  lh: '#e8b04b', rh: '#e8b04b', 'lh-todo': 'rgba(232,176,75,0.4)', 'rh-todo': 'rgba(232,176,75,0.4)', wrong: '#ff7a6b',
  scale: '#3a4054', char: '#ff7a6b', root: '#e8b04b',
}

interface Props {
  dots?: FretDot[]
  frets?: number
  muted?: number[] // cuerdas apagadas (6..1), se marcan con x junto a la cejilla
  capo?: number
  showNames?: boolean
  height?: number
  onDown?: (midi: number) => void
  onUp?: (midi: number) => void
}

const INLAYS = [3, 5, 7, 9, 12, 15, 17]

/**
 * Mástil de guitarra visto por el guitarrista: la 1ª cuerda (Mi agudo) arriba y la
 * 6ª abajo, como en las tablaturas. Los trastes se estrechan hacia el cuerpo,
 * igual que en una guitarra real.
 */
export default function Fretboard({ dots = [], frets = MAX_FRET, muted = [], capo = 0, showNames, height = 190, onDown, onUp }: Props) {
  const NUT_X = 34
  const W = 900
  const H = 150
  const top = 14
  const gap = (H - top * 2) / 5
  // Posición de cada traste según la regla de la guitarra (cada traste es 1/17,817 más corto).
  const fx = (f: number) => NUT_X + (W - NUT_X - 10) * (1 - Math.pow(2, -f / 12)) / (1 - Math.pow(2, -frets / 12))
  const cx = (f: number) => (f === 0 ? NUT_X - 14 : (fx(f - 1) + fx(f)) / 2)
  const sy = (string: number) => top + (string - 1) * gap // cuerda 1 arriba
  const pressedRef = useRef<number | null>(null)

  const handleDown = (string: number, f: number) => {
    const m = midiAt({ string, fret: f }) + capo
    pressedRef.current = m
    onDown?.(m)
  }
  const handleUp = () => {
    if (pressedRef.current !== null) onUp?.(pressedRef.current)
    pressedRef.current = null
  }

  return (
    <div className="fretboard-wrap" onPointerUp={handleUp} onPointerLeave={handleUp}>
      <svg className="fretboard" viewBox={`0 0 ${W} ${H + 18}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet" role="img"
           aria-label="Mástil de guitarra">
        <rect x={NUT_X} y={top - 6} width={W - NUT_X - 10} height={H - top * 2 + 12} rx={4} fill="#3a2a1c" />
        {INLAYS.filter((f) => f <= frets).map((f) => (
          f === 12
            ? <g key={f}><circle cx={cx(f)} cy={sy(2) + gap / 2} r={4} fill="#d9cbb0" /><circle cx={cx(f)} cy={sy(4) + gap / 2} r={4} fill="#d9cbb0" /></g>
            : <circle key={f} cx={cx(f)} cy={sy(3) + gap / 2} r={4.5} fill="#d9cbb0" opacity={0.85} />
        ))}
        {Array.from({ length: frets }, (_, i) => i + 1).map((f) => (
          <line key={f} x1={fx(f)} x2={fx(f)} y1={top - 6} y2={H - top + 6} stroke="#b9b4ab" strokeWidth={1.6} />
        ))}
        <rect x={NUT_X - 3} y={top - 7} width={6} height={H - top * 2 + 14} fill={capo ? '#e8b04b' : '#f1ece3'} rx={2} />
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <line key={s} x1={NUT_X - 2} x2={W - 10} y1={sy(s)} y2={sy(s)} stroke="#e9dfcc" strokeWidth={0.8 + (s - 1) * 0.35} opacity={0.9} />
        ))}
        {Array.from({ length: frets }, (_, i) => i + 1).filter((f) => INLAYS.includes(f)).map((f) => (
          <text key={f} x={cx(f)} y={H + 12} textAnchor="middle" fontSize={10} fill="var(--muted)">{f}</text>
        ))}
        {/* Zonas de clic: cada casilla (y la cuerda al aire) toca su nota */}
        {(onDown || onUp) && [1, 2, 3, 4, 5, 6].map((s) => Array.from({ length: frets + 1 }, (_, f) => (
          <rect key={`${s}-${f}`} x={f === 0 ? 0 : fx(f - 1)} y={sy(s) - gap / 2} width={f === 0 ? NUT_X - 2 : fx(f) - fx(f - 1)} height={gap}
                fill="transparent" style={{ cursor: 'pointer' }} onPointerDown={() => handleDown(s, f)} />
        )))}
        {muted.map((s) => <text key={`x${s}`} x={NUT_X - 14} y={sy(s) + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--coral)">×</text>)}
        {dots.map((d, i) => {
          const fill = FILL[d.mark] ?? '#e8b04b'
          const small = d.mark === 'scale'
          const name = showNames && !d.label ? pcName(TUNING[6 - d.string] + capo + d.fret) : undefined
          return (
            <g key={i} style={{ pointerEvents: 'none' }}>
              {d.fret === 0
                ? <circle cx={cx(0)} cy={sy(d.string)} r={7.5} fill="none" stroke={fill} strokeWidth={2.4} />
                : <circle cx={cx(d.fret)} cy={sy(d.string)} r={small ? 6.5 : 9} fill={fill} stroke={d.mark === 'root' ? '#fff' : 'none'} strokeWidth={1.5} />}
              {(d.label ?? name) && (
                <text x={cx(d.fret)} y={sy(d.string) + 3.8} textAnchor="middle" fontSize={d.fret === 0 ? 8 : 10.5} fontWeight={800}
                      fill={d.fret === 0 ? fill : small ? '#e9e4da' : '#14161d'}>{d.label ?? name}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
