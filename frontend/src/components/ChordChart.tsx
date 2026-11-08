import { useEffect, useMemo, useRef } from 'react'
import { fnColor } from '../lib/music'

export interface ChartSegment { start: number; end: number; symbol: string; roman?: string; function?: string | null; confidence: number; edited: boolean }

interface Bar { start: number; end: number; items: { seg: number; symbol: string; roman?: string; fn?: string | null; low: boolean; edited: boolean }[] }

/**
 * Agrupa los acordes en compases a partir de los pulsos detectados (4 por compás).
 * Si no hay pulso fiable se usan bloques de 2 segundos.
 */
export function buildBars(segments: ChartSegment[], beats: number[], duration: number, beatsPerBar = 4): Bar[] {
  const starts = beats.length >= beatsPerBar * 2
    ? beats.filter((_, i) => i % beatsPerBar === 0)
    : Array.from({ length: Math.ceil(duration / 2) }, (_, i) => i * 2)
  if (starts[0] > 0.3) starts.unshift(0)
  const bars: Bar[] = starts.map((s, i) => ({ start: s, end: starts[i + 1] ?? duration, items: [] }))
  bars.forEach((bar) => {
    segments.forEach((sg, i) => {
      if (sg.symbol === 'N') return
      const overlap = Math.min(bar.end, sg.end) - Math.max(bar.start, sg.start)
      // Un acorde aparece en el compás si ocupa al menos un cuarto o empieza dentro de él.
      if (overlap > (bar.end - bar.start) * 0.25 || (sg.start >= bar.start && sg.start < bar.end && overlap > 0.15)) {
        const last = bar.items[bar.items.length - 1]
        if (!last || last.symbol !== sg.symbol) {
          bar.items.push({ seg: i, symbol: sg.symbol, roman: sg.roman, fn: sg.function, low: sg.confidence < 0.6, edited: sg.edited })
        }
      }
    })
  })
  return bars
}

/** Tabla de acordes por compases + franja de resumen de toda la canción. */
export default function ChordChart({ segments, beats, duration, time, selected, onPick, onSeek }: {
  segments: ChartSegment[]; beats: number[]; duration: number; time: number; selected: number | null
  onPick: (segment: number, at: number) => void; onSeek: (t: number) => void
}) {
  const bars = useMemo(() => buildBars(segments, beats, duration), [segments, beats, duration])
  const current = bars.findIndex((b) => time >= b.start && time < b.end)
  const ref = useRef<HTMLDivElement>(null)
  // Mientras suena, el compás actual se mantiene a la vista dentro de la tabla.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-bar="${current}"]`)
    if (el && ref.current) {
      const box = ref.current.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      if (r.top < box.top || r.bottom > box.bottom) ref.current.scrollTop += r.top - box.top - 40
    }
  }, [current])

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="overview" onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        onSeek(((e.clientX - r.left) / r.width) * duration)
      }} title="Toda la canción: haz clic para saltar">
        {segments.map((s, i) => s.symbol !== 'N' && (
          <span key={i} style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%`, background: fnColor(s.function) }} />
        ))}
        <i style={{ left: `${(time / duration) * 100}%` }} />
      </div>
      <div className="chart" ref={ref}>
        {bars.map((b, i) => (
          <div key={i} data-bar={i} className={`bar ${i === current ? 'now' : ''} ${b.items.some((x) => x.seg === selected) ? 'sel' : ''}`}
               onClick={() => b.items[0] ? onPick(b.items[0].seg, b.start) : onSeek(b.start)}>
            <span className="bar-n">{i + 1}</span>
            {b.items.length === 0 ? <span className="muted">—</span> : b.items.slice(0, 3).map((it, k) => (
              <span key={k} className={`bar-chord ${it.low ? 'low' : ''} ${it.edited ? 'edited' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onPick(it.seg, Math.max(b.start, segments[it.seg].start)) }}>
                <b style={{ borderColor: fnColor(it.fn) }}>{it.symbol}</b>
                {it.roman && <small style={{ color: fnColor(it.fn) }}>{it.roman}</small>}
              </span>
            ))}
            {b.items.length > 3 && <span className="small muted">+{b.items.length - 3}</span>}
          </div>
        ))}
      </div>
      <div className="small muted">Compases de 4 pulsos · subrayado tenue = acorde dudoso · turquesa = corregido por ti · clic para escuchar y corregir</div>
    </div>
  )
}
