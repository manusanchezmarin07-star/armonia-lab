import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Piano, { type Mark } from '../components/Piano'
import PcCircle from '../components/PcCircle'
import { IconPlay } from '../components/Icons'
import { api, type ScaleInfo, type ScaleSummary } from '../lib/api'
import { playChord, playSequence } from '../lib/audio'
import { TONICS, pcName } from '../lib/music'

const STEP_NAME: Record<number, string> = { 1: 'S', 2: 'T', 3: 'T½', 4: '2T' }

export default function Scales() {
  const [catalog, setCatalog] = useState<ScaleSummary[]>([])
  const [params] = useSearchParams()
  const [id, setId] = useState(params.get('id') ?? 'dorian')
  const [tonic, setTonic] = useState(params.get('tonic') ?? 'D')
  const [info, setInfo] = useState<ScaleInfo | null>(null)

  useEffect(() => { api.get<ScaleSummary[]>('/api/scales').then(setCatalog) }, [])
  useEffect(() => { api.get<ScaleInfo>(`/api/scales/${id}?tonic=${encodeURIComponent(tonic)}`).then(setInfo) }, [id, tonic])

  const families = useMemo(() => {
    const m = new Map<string, ScaleSummary[]>()
    catalog.forEach((s) => m.set(s.family, [...(m.get(s.family) ?? []), s]))
    return [...m.entries()]
  }, [catalog])

  // Escala sobre dos octavas a partir de la tónica en la octava 4.
  const base = info ? 60 + (info.pcs[0] % 12) - (info.pcs[0] % 12 > 6 ? 12 : 0) : 60
  const midiNotes = info ? [...info.degrees.map((d) => base + d), ...info.degrees.map((d) => base + 12 + d), base + 24] : []
  const marks: Record<number, Mark> = {}
  midiNotes.forEach((m) => {
    const pc = m % 12
    marks[m] = pc === info!.pcs[0] ? 'root' : info!.characteristic_pcs.includes(pc) ? 'char' : 'scale'
  })
  const names: Record<number, string> = {}
  info?.pcs.forEach((pc, i) => (names[pc] = info.notes[i]))
  const labels: Record<number, string> = {}
  midiNotes.forEach((m) => (labels[m] = names[m % 12]))

  // Para escalas simétricas: qué otras tónicas producen exactamente las mismas notas.
  const equivalents = info?.symmetric
    ? Array.from({ length: 12 }, (_, t) => t).filter((t) => {
        const set = new Set(info.pcs.map((p) => (p + t) % 12))
        return t !== 0 && info.pcs.every((p) => set.has(p))
      }).map((t) => pcName(info.pcs[0] + t))
    : []

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Escalas</div>
          <h1>Modos, colores y simetría</h1>
          <p className="lead">Cada modo es la misma familia de notas vista desde otro centro. En el reloj las escalas
            simétricas forman figuras regulares: esa regularidad es la que las convierte en puentes entre tonalidades.</p>
        </div>
        <label>
          <span className="label">Tónica</span>
          <select className="select" value={tonic} onChange={(e) => setTonic(e.target.value)}>
            {TONICS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-side-l">
        <div className="card flush" style={{ maxHeight: 720, overflowY: 'auto' }} data-tour="scales-list">
          {families.map(([fam, list]) => (
            <div key={fam}>
              <div className="nav-section" style={{ padding: '14px 16px 6px' }}>{fam}</div>
              {list.map((s) => (
                <div key={s.id} className={`list-item ${s.id === id ? 'on' : ''}`} style={{ padding: '9px 16px' }} onClick={() => setId(s.id)}>
                  <div className="row">
                    <span>{s.name}</span>
                    <div className="spacer" />
                    {s.symmetric && <span className="pill violet" style={{ fontSize: 10.5 }}>simétrica</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {info && (
          <div className="stack fade-in" key={info.id + info.tonic}>
            <div className="card">
              <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <h2 style={{ fontSize: 28 }}>{info.tonic} {info.name}</h2>
                  <p className="explain">{info.description}</p>
                  <div className="row" style={{ margin: '12px 0' }}>
                    {info.notes.map((n, i) => (
                      <div key={i} className="seq-item" style={{ minWidth: 52, padding: '8px 10px', textAlign: 'center', cursor: 'default',
                        borderColor: info.characteristic_pcs.includes(info.pcs[i]) ? 'var(--coral)' : undefined }}>
                        <div className="sym" style={{ fontSize: 18 }}>{n}</div>
                        <div className="rn">{i < info.steps.length ? STEP_NAME[info.steps[i]] ?? info.steps[i] : ''}</div>
                      </div>
                    ))}
                  </div>
                  <div className="row">
                    <span className="pill">{info.size ?? info.pcs.length} notas</span>
                    <span className={`pill ${info.symmetric ? 'violet' : ''}`}>
                      {info.transpositions} transposicion{info.transpositions === 1 ? '' : 'es'} distinta{info.transpositions === 1 ? '' : 's'}
                    </span>
                    {info.characteristic_pcs.length > 0 && <span className="pill coral">nota característica: {info.characteristic_pcs.map((p) => names[p]).join(', ')}</span>}
                  </div>
                  {equivalents.length > 0 && (
                    <p className="explain">Por simetría, {info.tonic} {info.name.split(' (')[0].toLowerCase()} tiene las mismas notas
                      empezando en <b>{equivalents.join(', ')}</b>. Por eso un mismo acorde o escala sirve para varias tonalidades a la vez.</p>
                  )}
                </div>
                <div data-tour="scales-circle"><PcCircle pcs={info.pcs} accent={info.characteristic_pcs} root={info.pcs[0]} names={names} size={250} /></div>
              </div>
            </div>
            <div className="card">
              <div className="row" style={{ marginBottom: 10 }}>
                <button className="btn primary sm" onClick={() => playSequence([...midiNotes.slice(0, info.pcs.length + 1)].map((m) => [m]), 0.28)}>
                  <IconPlay /> Subir
                </button>
                <button className="btn sm" onClick={() => playSequence([...midiNotes.slice(0, info.pcs.length + 1)].reverse().map((m) => [m]), 0.28)}>Bajar</button>
                <button className="btn sm" onClick={() => playChord(midiNotes.slice(0, info.pcs.length), 2.5, 0.06)}>Todas a la vez</button>
                <div className="spacer" />
                <span className="small muted">Punto rojo = nota que define el color del modo</span>
              </div>
              <Piano from={base - (base % 12) - 0} to={base - (base % 12) + 36} marks={marks} labels={labels} height={140} />
            </div>
            {info.chords.length > 0 && (
              <div className="card">
                <h3>Acordes de la escala (por terceras)</h3>
                <div className="row">
                  {info.chords.map((c) => (
                    <div key={c.degree} className="seq-item" onClick={() => {
                      let prev = 47
                      const notes = c.pcs.map((pc) => { let m = prev + 1 + ((pc - prev - 1 + 120) % 12); prev = m; return m })
                      playChord([36 + c.pcs[0] + (c.pcs[0] < 4 ? 12 : 0), ...notes], 1.8)
                    }}>
                      <div className="sym" style={{ fontSize: 19 }}>{c.symbol}</div>
                      <div className="rn">grado {c.degree}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
