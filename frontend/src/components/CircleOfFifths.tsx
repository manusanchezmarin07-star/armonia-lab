const MAJORS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']
const MINORS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm']

interface Props {
  from: string
  to: string
  onPick: (key: string, which: 'from' | 'to') => void
  size?: number
}

/**
 * Círculo de quintas interactivo: anillo exterior mayores, interior relativas menores.
 * Clic = destino, Mayús+clic (o clic derecho) = origen. La distancia en el círculo
 * anticipa cuántas notas comparten dos tonalidades: vecinas = cambio suave.
 */
export default function CircleOfFifths({ from, to, onPick, size = 300 }: Props) {
  const c = size / 2
  const rOut = size / 2 - 22
  const rIn = rOut - 44
  const pos = (i: number, r: number) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    return [c + Math.cos(a) * r, c + Math.sin(a) * r]
  }
  const idx = (k: string) => {
    const i = MAJORS.indexOf(k === 'Gb' ? 'F#' : k)
    return i >= 0 ? i : MINORS.indexOf(k === 'Ebm' ? 'D#m' : k)
  }
  const fi = idx(from)
  const ti = idx(to)
  const arc = (() => {
    if (fi < 0 || ti < 0 || fi === ti) return null
    const r = (from.endsWith('m') ? rIn : rOut) - 2
    const r2 = (to.endsWith('m') ? rIn : rOut) - 2
    const [x1, y1] = pos(fi, r)
    const [x2, y2] = pos(ti, r2)
    return `M${x1},${y1} Q${c},${c} ${x2},${y2}`
  })()

  const node = (k: string, i: number, r: number, minor: boolean) => {
    const [x, y] = pos(i, r)
    const isFrom = k === from || (k === 'F#' && from === 'Gb') || (k === 'D#m' && from === 'Ebm')
    const isTo = k === to || (k === 'F#' && to === 'Gb') || (k === 'D#m' && to === 'Ebm')
    const fill = isTo ? 'var(--accent)' : isFrom ? 'var(--teal)' : minor ? 'var(--bg-2)' : 'var(--surface-2)'
    return (
      <g key={k} style={{ cursor: 'pointer' }}
         onClick={(e) => onPick(k, e.shiftKey ? 'from' : 'to')}
         onContextMenu={(e) => { e.preventDefault(); onPick(k, 'from') }}>
        <circle cx={x} cy={y} r={minor ? 17 : 21} fill={fill} stroke={isFrom || isTo ? 'transparent' : 'var(--line)'} />
        <text x={x} y={y + 4.5} textAnchor="middle" fontSize={minor ? 11 : 13.5} fontWeight={650}
              fill={isFrom || isTo ? '#14161d' : minor ? 'var(--text-2)' : 'var(--text)'} style={{ pointerEvents: 'none' }}>{k}</text>
      </g>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      <circle cx={c} cy={c} r={rOut} fill="none" stroke="var(--line-soft)" />
      <circle cx={c} cy={c} r={rIn} fill="none" stroke="var(--line-soft)" />
      {arc && <path d={arc} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 5" opacity={0.8} />}
      {MAJORS.map((k, i) => node(k, i, rOut, false))}
      {MINORS.map((k, i) => node(k, i, rIn, true))}
    </svg>
  )
}
