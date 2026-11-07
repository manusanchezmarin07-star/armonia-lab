import { pcName } from '../lib/music'

interface Props {
  pcs: number[]
  size?: number
  accent?: number[]
  second?: number[]
  axis?: number | null // tónica para dibujar el eje de la armonía negativa
  root?: number
  names?: Record<number, string>
}

/**
 * Reloj de las 12 notas. Une las notas con un polígono: las escalas simétricas
 * se ven al instante como figuras regulares (hexágono, cuadrado, triángulo...).
 */
export default function PcCircle({ pcs, size = 240, accent = [], second, axis = null, root, names = {} }: Props) {
  const c = size / 2
  const r = size / 2 - 30
  const pt = (pc: number, rr = r) => {
    const a = (pc / 12) * Math.PI * 2 - Math.PI / 2
    return [c + Math.cos(a) * rr, c + Math.sin(a) * rr]
  }
  const poly = (list: number[]) => [...new Set(list)].sort((a, b) => a - b).map((p) => pt(p).join(',')).join(' ')
  // El eje negativo pasa entre la 3ª menor y la mayor: tónica + 3,5 semitonos.
  const axisLine = axis !== null ? [pt((axis + 3.5) % 12, r + 18), pt((axis + 9.5) % 12, r + 18)] : null
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeDasharray="2 5" />
      {axisLine && (
        <line x1={axisLine[0][0]} y1={axisLine[0][1]} x2={axisLine[1][0]} y2={axisLine[1][1]}
              stroke="var(--violet)" strokeWidth={1.5} strokeDasharray="6 4" />
      )}
      {second && second.length > 1 && (
        <polygon points={poly(second)} fill="var(--violet-soft)" stroke="var(--violet)" strokeWidth={1.6} />
      )}
      {pcs.length > 1 && <polygon points={poly(pcs)} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.8} />}
      {Array.from({ length: 12 }, (_, pc) => {
        const [x, y] = pt(pc)
        const on = pcs.includes(pc)
        const on2 = second?.includes(pc)
        const isAcc = accent.includes(pc)
        const [lx, ly] = pt(pc, r + 17)
        return (
          <g key={pc}>
            <circle cx={x} cy={y} r={on || on2 ? 6.5 : 3}
                    fill={isAcc ? 'var(--coral)' : on ? 'var(--accent)' : on2 ? 'var(--violet)' : 'var(--line)'}
                    stroke={root === pc ? 'var(--text)' : 'none'} strokeWidth={2} />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize={11.5} fontWeight={on || on2 ? 650 : 400}
                  fill={on || on2 ? 'var(--text)' : 'var(--muted)'}>{names[pc] ?? pcName(pc)}</text>
          </g>
        )
      })}
    </svg>
  )
}
