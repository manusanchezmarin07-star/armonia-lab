import { fnColor } from '../lib/music'

interface Props {
  symbol: string
  sub?: string
  fn?: string | null
  active?: boolean
  title?: string
  small?: boolean
  onClick?: () => void
}

/** Ficha de acorde reutilizable: cifrado, grado y barra de color según la función tonal. */
export default function ChordChip({ symbol, sub, fn, active, title, small, onClick }: Props) {
  return (
    <div className={`seq-item ${active ? 'on' : ''}`} title={title} onClick={onClick}
         style={{ cursor: onClick ? 'pointer' : 'default', ...(small ? { minWidth: 70, padding: '9px 11px' } : {}) }}>
      {fn !== undefined && <div className="fn" style={{ background: fnColor(fn) }} />}
      <div className="sym" style={small ? { fontSize: 17 } : undefined}>{symbol}</div>
      {sub && <div className="rn" style={{ color: fn !== undefined ? fnColor(fn) : undefined }}>{sub}</div>}
    </div>
  )
}
