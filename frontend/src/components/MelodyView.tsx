import { useEffect, useMemo, useRef, useState } from 'react'
import Keys from './Keys'
import type { Mark } from './Piano'
import { api } from '../lib/api'
import { noteOff, noteOn } from '../lib/audio'
import { downloadMidi, notesToMidi } from '../lib/midifile'

export interface MelodyNote { start: number; end: number; midi: number; name: string; degree?: number }
export interface MelodyJob {
  id: string; title: string
  melody?: { stem: string; notes: MelodyNote[]; low: number | null; high: number | null; count: number }
  melody_status?: string; melody_error?: string
}

const WINDOW = 10 // segundos visibles en el rollo
const AHEAD = 0.72 // parte de la ventana que queda por delante del cursor
const SOLFA = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si']
const solfa = (m: number) => `${SOLFA[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`
// Color según el grado en la tonalidad: tónica, 3ª y 5ª (las notas «de reposo») destacan.
const colorOf = (n: MelodyNote) => (n.degree === 0 ? 'var(--accent)' : n.degree === 7 || n.degree === 3 || n.degree === 4 ? 'var(--teal)' : 'var(--brand-hi)')

/** Índice de la nota que suena en el instante t (búsqueda binaria: las notas van ordenadas), o -1. */
export function noteAt(notes: MelodyNote[], t: number): number {
  let lo = 0
  let hi = notes.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (t < notes[mid].start) hi = mid - 1
    else if (t >= notes[mid].end) lo = mid + 1
    else return mid
  }
  return -1
}

/**
 * Melodía de la canción: las notas (una a la vez) de la voz o de la pista que se elija,
 * en un rollo que avanza con la música, con la nota actual en el instrumento. Se puede
 * hacer sonar encima para comprobarla y exportar a MIDI.
 */
export default function MelodyView({ job, time, playing, onSeek, onJob }: {
  job: MelodyJob; time: number; playing: boolean; onSeek: (t: number) => void; onJob: (j: never) => void
}) {
  const [sources, setSources] = useState<{ id: string; name: string }[]>([])
  const [stem, setStem] = useState(job.melody?.stem ?? '')
  const [sound, setSound] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const sounding = useRef<number | null>(null)
  const notes = job.melody?.notes ?? []
  const busy = job.melody_status === 'analizando'

  useEffect(() => {
    api.get<{ id: string; name: string }[]>(`/api/stems/${job.id}/melody/sources`).then((s) => { setSources(s); setStem((cur) => cur || s[0]?.id || '') }).catch(() => {})
  }, [job.id])
  // Mientras se detecta, se consulta la ficha hasta que termina.
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => api.get<MelodyJob>(`/api/stems/${job.id}`).then((j) => { if (j.melody_status !== 'analizando') onJob(j as never) }).catch(() => {}), 1500)
    return () => clearInterval(t)
  }, [busy, job.id])

  const detect = () => {
    setErr(null)
    api.post<MelodyJob>(`/api/stems/${job.id}/melody${stem ? `?stem=${encodeURIComponent(stem)}` : ''}`, {}).then((j) => onJob(j as never)).catch((e) => setErr((e as Error).message))
  }

  const idx = useMemo(() => noteAt(notes, time), [notes, time])
  const cur = idx >= 0 ? notes[idx] : null
  const next = notes.find((n) => n.start > time)

  // Tocar la melodía encima: suena cada nota cuando empieza y se apaga al acabar o al pausar.
  useEffect(() => {
    const want = sound && playing && cur ? cur.midi : null
    if (want === sounding.current) return
    if (sounding.current !== null) noteOff(sounding.current)
    if (want !== null) noteOn(want, 0.7)
    sounding.current = want
  }, [sound, playing, cur?.midi, cur?.start])
  useEffect(() => () => { if (sounding.current !== null) noteOff(sounding.current) }, [])

  const low = (job.melody?.low ?? 60) - 2
  const high = (job.melody?.high ?? 72) + 2
  const H = 190
  const rowH = H / (high - low + 1)
  const t0 = time - WINDOW * (1 - AHEAD)
  const x = (t: number) => ((t - t0) / WINDOW) * 1000
  const y = (m: number) => (high - m) * rowH
  const visible = notes.filter((n) => n.end > t0 && n.start < t0 + WINDOW)
  const marks: Record<number, Mark> = cur ? { [cur.midi]: 'target' } : {}

  return (
    <div className="card stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>Melodía</h2>
        {job.melody && <span className="pill">{job.melody.count} notas · de {solfa(job.melody.low ?? 60)} a {solfa(job.melody.high ?? 72)}</span>}
        <div className="spacer" />
        <label className="small text-2 row" style={{ gap: 6 }}>Pista
          <select className="select" value={stem} onChange={(e) => setStem(e.target.value)} aria-label="Pista de la melodía" disabled={busy}>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <button className="btn primary" onClick={detect} disabled={busy || !stem}>{busy ? 'Detectando…' : job.melody ? 'Volver a detectar' : 'Detectar melodía'}</button>
      </div>
      {(err || job.melody_status === 'error') && <div className="error">{err ?? `No se pudo detectar la melodía: ${job.melody_error}`}</div>}
      {!job.melody && !busy && (
        <p className="explain" style={{ margin: 0 }}>Saco la melodía nota a nota de la pista que elijas. Funciona bien con <b>la voz o un instrumento que toque una sola nota a la vez</b>
          {' '}(flauta, violín, una guitarra punteada). Con acordes o varios instrumentos juntos se confunde: si la canción es instrumental, prueba con la pista donde vaya el tema.</p>
      )}
      {job.melody && notes.length === 0 && <div className="notice">No he encontrado una melodía clara en esa pista. Prueba con otra.</div>}

      {notes.length > 0 && (
        <>
          <div className="now-next" aria-label="Nota actual y siguiente">
            <div className="nn-now" style={{ flex: '0 1 220px' }}>
              <span className="small muted">Ahora</span>
              <b style={{ color: cur ? colorOf(cur) : undefined }}>{cur ? solfa(cur.midi) : '—'}</b>
              <small>{cur ? cur.name : 'silencio'}</small>
            </div>
            {next && (
              <div className="nn-next" onClick={() => onSeek(next.start)} title="Saltar a esta nota">
                <span className="small muted">Siguiente · en {Math.max(0, next.start - time).toFixed(1)} s</span>
                <b>{solfa(next.midi)}</b>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 220, alignContent: 'center' }}>
              <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> Tocar la melodía encima (para comprobarla)
              </label>
              <button className="btn sm" style={{ justifySelf: 'start', marginTop: 6 }}
                      onClick={() => downloadMidi(`melodía ${job.title}`, notesToMidi(notes.map((n) => ({ note: n.midi, start: n.start * 1000, end: n.end * 1000, velocity: 0.8 }))))}>Exportar melodía .mid</button>
            </div>
          </div>
          <svg className="melody-roll" viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" role="img" aria-label="Rollo de la melodía"
               onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(Math.max(0, t0 + ((e.clientX - r.left) / r.width) * WINDOW)) }}>
            {/* Una franja por cada Do, para orientarse en la altura */}
            {Array.from({ length: high - low + 1 }, (_, i) => low + i).filter((m) => m % 12 === 0).map((m) => (
              <rect key={m} x={0} y={y(m)} width={1000} height={rowH} fill="rgba(255,255,255,0.045)" />
            ))}
            {visible.map((n) => (
              <rect key={n.start} x={x(n.start)} y={y(n.midi) + 0.5} width={Math.max(3, x(n.end) - x(n.start) - 1)} height={Math.max(6, rowH - 1)} rx={2}
                    fill={colorOf(n)} opacity={n === cur ? 1 : 0.7} stroke={n === cur ? '#fff' : 'none'} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={x(time)} x2={x(time)} y1={0} y2={H} stroke="var(--coral)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="row small text-2" style={{ gap: 14 }}>
            <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--accent)' }} /> tónica</span>
            <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--teal)' }} /> 3ª y 5ª</span>
            <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--brand-hi)' }} /> el resto</span>
            <span className="muted">Clic en el rollo para saltar. La detección no es perfecta: fíate del oído.</span>
          </div>
          <Keys from={Math.max(36, low - 3)} to={Math.min(96, high + 3)} marks={marks} height={110} showNames />
        </>
      )}
    </div>
  )
}
