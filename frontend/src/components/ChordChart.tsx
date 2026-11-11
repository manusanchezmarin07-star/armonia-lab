import { useEffect, useMemo, useRef } from 'react'
import { fnColor } from '../lib/music'

export interface ChartSegment { start: number; end: number; symbol: string; roman?: string; function?: string | null; confidence: number; edited: boolean }

interface Bar { start: number; end: number; items: { seg: number; symbol: string; roman?: string; fn?: string | null; low: boolean; edited: boolean }[] }

/**
 * Dónde empiezan los compases y de cuántos pulsos son.
 *
 * El detector de pulso no sabe cuál es el primer tiempo del compás (puede haber
 * anacrusa o una intro) ni si la canción va a 3 o a 4. Pero los acordes cambian
 * casi siempre en el primer tiempo: se elige el desfase (y el compás de 3 o de 4)
 * que hace coincidir más cambios de acorde con el principio de un compás. Así cada
 * casilla contiene un acorde entero y no dos medios.
 */
export function barGrid(segments: ChartSegment[], beats: number[]): { offset: number; perBar: number } {
  if (beats.length < 8) return { offset: 0, perBar: 4 }
  const changes = segments.filter((s, i) => s.symbol !== 'N' && (i === 0 || segments[i - 1].symbol !== s.symbol)).map((s) => s.start)
  if (changes.length < 3) return { offset: 0, perBar: 4 } // con uno o dos acordes no hay con qué alinear
  // Índice del pulso más cercano a cada cambio de acorde.
  const idx = changes.map((t) => beats.reduce((best, b, i) => (Math.abs(b - t) < Math.abs(beats[best] - t) ? i : best), 0))
  let best = { offset: 0, perBar: 4, hits: -1 }
  for (const perBar of [4, 3]) {
    for (let offset = 0; offset < perBar; offset++) {
      const hits = idx.filter((i) => (((i - offset) % perBar) + perBar) % perBar === 0).length
      // El compás de 3 solo gana si encaja claramente mejor: con pocos acordes, 3 y 4 empatan a menudo.
      if (perBar === 4 ? hits > best.hits : hits > best.hits * 1.25) best = { offset, perBar, hits }
    }
  }
  return { offset: best.offset, perBar: best.perBar }
}

/**
 * Agrupa los acordes en compases a partir de los pulsos detectados.
 * Si no hay pulso fiable se usan bloques de 2 segundos.
 */
export function buildBars(segments: ChartSegment[], beats: number[], duration: number, grid = barGrid(segments, beats)): Bar[] {
  const starts = beats.length >= grid.perBar * 2
    ? beats.filter((_, i) => i >= grid.offset && (i - grid.offset) % grid.perBar === 0)
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
  const grid = useMemo(() => barGrid(segments, beats), [segments, beats])
  const bars = useMemo(() => buildBars(segments, beats, duration, grid), [segments, beats, duration, grid])
  const playingSeg = segments.findIndex((sg) => time >= sg.start && time < sg.end)
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
              <span key={k} className={`bar-chord ${it.low ? 'low' : ''} ${it.edited ? 'edited' : ''} ${i === current && it.seg === playingSeg ? 'now' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onPick(it.seg, Math.max(b.start, segments[it.seg].start)) }}>
                <b style={{ borderColor: fnColor(it.fn) }}>{it.symbol}</b>
                {it.roman && <small style={{ color: fnColor(it.fn) }}>{it.roman}</small>}
              </span>
            ))}
            {b.items.length > 3 && <span className="small muted">+{b.items.length - 3}</span>}
          </div>
        ))}
      </div>
      <div className="small muted">Compases de {grid.perBar} pulsos · subrayado tenue = acorde dudoso · turquesa = corregido por ti · clic para escuchar y corregir</div>
    </div>
  )
}
