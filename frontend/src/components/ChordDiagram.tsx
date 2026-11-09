import type { Shape } from '../lib/guitar'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']

/**
 * Diagrama de acorde de guitarra clásico (como en los cancioneros): cuerdas en
 * vertical (6ª a la izquierda), trastes en horizontal, × apagada, ○ al aire,
 * puntos con el número de dedo y la cejilla como una barra.
 */
export default function ChordDiagram({ shape, size = 1, active, onClick }: { shape: Shape; size?: number; active?: boolean; onClick?: () => void }) {
  const rows = 5
  const W = 110
  const H = 150
  const left = 20
  const right = W - 12
  const topY = 34
  const fretH = (H - topY - 10) / rows
  const sx = (i: number) => left + (i * (right - left)) / 5 // i = 0 (6ª) … 5 (1ª)
  const base = shape.base_fret
  const fy = (f: number) => topY + (f - base + 0.5) * fretH
  const barre = shape.barre
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * size} height={H * size} className={`chord-diagram ${active ? 'on' : ''}`}
         onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }} role="img" aria-label={`${shape.symbol} ${shape.diagram}`}>
      <text x={W / 2} y={13} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text)" style={{ fontFamily: 'var(--serif)' }}>{shape.shape_of ?? shape.symbol}</text>
      {base > 1 && <text x={2} y={fy(base) + 4} fontSize={10} fill="var(--text-2)">{ROMAN[base] ?? base}</text>}
      <rect x={left} y={topY} width={right - left} height={rows * fretH} fill="none" />
      {Array.from({ length: rows + 1 }, (_, r) => (
        <line key={r} x1={left} x2={right} y1={topY + r * fretH} y2={topY + r * fretH} stroke="var(--text-2)" strokeWidth={r === 0 && base === 1 ? 4 : 1} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={sx(i)} x2={sx(i)} y1={topY} y2={topY + rows * fretH} stroke="var(--text-2)" strokeWidth={1} />)}
      {shape.frets.map((f, i) => f <= 0 && (
        <text key={`o${i}`} x={sx(i)} y={topY - 7} textAnchor="middle" fontSize={11} fontWeight={700} fill={f < 0 ? 'var(--coral)' : 'var(--teal)'}>{f < 0 ? '×' : '○'}</text>
      ))}
      {barre && (() => {
        const a = 6 - barre.from_string
        const b = 6 - barre.to_string
        return <rect x={sx(a) - 6} y={fy(barre.fret) - 6} width={sx(b) - sx(a) + 12} height={12} rx={6} fill="var(--accent)" />
      })()}
      {shape.frets.map((f, i) => f > 0 && (
        <g key={i}>
          <circle cx={sx(i)} cy={fy(f)} r={7} fill="var(--accent)" />
          {shape.fingers[i] > 0 && <text x={sx(i)} y={fy(f) + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#14161d">{shape.fingers[i]}</text>}
        </g>
      ))}
    </svg>
  )
}
