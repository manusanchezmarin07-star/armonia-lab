import type { Shape } from '../lib/guitar'

export interface TabColumn { frets: number[] | null; top?: string; accent?: boolean; bottom?: string }

/**
 * Tablatura: seis líneas (la 1ª, Mi agudo, arriba), un número de traste por cuerda
 * en cada columna. Encima van los golpes de mano derecha (con «>» si es acento) y
 * debajo el número de compás que se cuenta.
 */
export default function Tab({ columns, current, colW = 46 }: { columns: TabColumn[]; current?: number | null; colW?: number }) {
  const left = 26
  const top = 34
  const gap = 13
  const W = left + columns.length * colW + 10
  const H = top + gap * 5 + 30
  const y = (stringIdx: number) => top + (5 - stringIdx) * gap // stringIdx 0 = 6ª (abajo)
  return (
    <div className="tab-wrap">
      <svg className="tab" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: W, maxWidth: W * 1.5 }} role="img" aria-label="Tablatura">
        {['e', 'B', 'G', 'D', 'A', 'E'].map((n, i) => (
          <g key={i}>
            <text x={6} y={top + i * gap + 4} fontSize={10} fill="var(--muted)">{n}</text>
            <line x1={left - 6} x2={W - 6} y1={top + i * gap} y2={top + i * gap} stroke="var(--line)" />
          </g>
        ))}
        {columns.map((c, k) => {
          const x = left + k * colW + colW / 2
          return (
            <g key={k}>
              {current === k && <rect x={x - colW / 2 + 2} y={4} width={colW - 4} height={H - 8} rx={6} fill="var(--accent-soft)" />}
              {c.accent && <text x={x} y={11} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--coral)">&gt;</text>}
              {c.top && <text x={x} y={24} textAnchor="middle" fontSize={c.top.length > 6 ? 8.5 : 10.5} fontWeight={700} fill="var(--text)">{c.top}</text>}
              {c.frets?.map((f, s) => f >= 0 && (
                <g key={s}>
                  <rect x={x - 7} y={y(s) - 6} width={14} height={12} fill="var(--surface)" />
                  <text x={x} y={y(s) + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={c.accent ? 'var(--accent)' : 'var(--text-2)'}>{f}</text>
                </g>
              ))}
              {c.bottom && <text x={x} y={H - 6} textAnchor="middle" fontSize={11} fontWeight={c.accent ? 800 : 500} fill={c.accent ? 'var(--coral)' : 'var(--muted)'}>{c.bottom}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export const shapeFrets = (s: Shape | null | undefined) => (s ? s.frets : null)
