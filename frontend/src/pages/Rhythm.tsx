import { useEffect, useRef, useState } from 'react'
import { IconPlay, IconStop } from '../components/Icons'
import { api, type Palo } from '../lib/api'
import { Tone, click } from '../lib/audio'

export default function Rhythm() {
  const [palos, setPalos] = useState<Palo[]>([])
  const [meters, setMeters] = useState<Palo[]>([])
  const [sel, setSel] = useState<Palo | null>(null)
  const [accents, setAccents] = useState<number[]>([])
  const [bpm, setBpm] = useState(120)
  const [beat, setBeat] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const loopRef = useRef<Tone.Loop | null>(null)
  const beatRef = useRef(0)

  useEffect(() => {
    api.get<{ palos: Palo[]; meters: Palo[] }>('/api/rhythm').then((d) => {
      setPalos(d.palos)
      setMeters(d.meters)
      choose(d.palos[0])
    })
    return () => stop()
  }, [])

  const choose = (p: Palo) => {
    stop()
    setSel(p)
    setAccents(p.accents)
    setBpm(p.bpm)
  }

  const stop = () => {
    loopRef.current?.dispose()
    loopRef.current = null
    Tone.getTransport().stop()
    setPlaying(false)
    setBeat(-1)
  }

  // Se programa con el Transport de Tone.js (reloj de audio) y no con setInterval,
  // porque los temporizadores del navegador derivan y el compás se "arrastraría".
  const start = async () => {
    if (!sel) return
    await Tone.start()
    const transport = Tone.getTransport()
    transport.bpm.value = bpm
    // Palos como la bulería arrancan en el 12: el ciclo empieza donde se cuenta.
    beatRef.current = (sel.count_start ?? 1) - 1
    const accRef = { current: accents }
    loopRef.current = new Tone.Loop((time) => {
      const b = beatRef.current % sel.beats
      click(accRef.current.includes(b + 1), time)
      Tone.getDraw().schedule(() => setBeat(b), time)
      beatRef.current++
    }, '4n').start(0)
    transport.start()
    setPlaying(true)
  }

  useEffect(() => { Tone.getTransport().bpm.value = bpm }, [bpm])
  useEffect(() => { if (playing) { stop(); start() } }, [accents])

  const toggleAccent = (b: number) => setAccents((a) => (a.includes(b) ? a.filter((x) => x !== b) : [...a, b].sort((x, y) => x - y)))

  const labelOf = (i: number) => String(i + 1)

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Ritmo</div>
          <h1>Compás y palos flamencos</h1>
          <p className="lead">El ciclo se dibuja como un reloj: los tiempos grandes son los acentos. Pulsa cualquier tiempo
            para acentuarlo o quitarle el acento y crear tus propias amalgamas.</p>
        </div>
      </div>
      <div className="grid grid-side-l">
        <div className="card flush">
          <div className="nav-section" style={{ padding: '14px 16px 6px' }}>Palos flamencos</div>
          {palos.map((p) => (
            <div key={p.id} className={`list-item ${sel?.id === p.id ? 'on' : ''}`} style={{ padding: '10px 16px' }} onClick={() => choose(p)}>
              <div className="row"><span>{p.name}</span><div className="spacer" /><span className="small muted">{p.beats} t</span></div>
            </div>
          ))}
          <div className="nav-section" style={{ padding: '14px 16px 6px' }}>Compases</div>
          {meters.map((p) => (
            <div key={p.id} className={`list-item ${sel?.id === p.id ? 'on' : ''}`} style={{ padding: '10px 16px' }} onClick={() => choose(p)}>
              <div className="row"><span>{p.name}</span><div className="spacer" /><span className="small muted">{p.grouping.join('+')}</span></div>
            </div>
          ))}
        </div>

        {sel && (
          <div className="stack">
            <div className="card">
              <div className="row" style={{ alignItems: 'flex-start', gap: 30 }}>
                <Clock beats={sel.beats} accents={accents} current={beat} onToggle={toggleAccent} labelOf={labelOf} />
                <div style={{ flex: 1, minWidth: 260 }} className="stack">
                  <h2 style={{ fontSize: 30, margin: 0 }}>{sel.name}</h2>
                  <p className="explain" style={{ margin: 0 }}>{sel.description}</p>
                  <div className="row">
                    <span className="pill accent">Acentos: {accents.join(' · ') || '—'}</span>
                    {sel.count_start && sel.count_start !== 1 && <span className="pill">Se empieza a contar en el {sel.count_start}</span>}
                  </div>
                  {sel.variants && (
                    <div className="row">
                      <span className="small muted">Variantes:</span>
                      <button className="btn sm ghost" onClick={() => setAccents(sel.accents)}>Principal</button>
                      {sel.variants.map((v) => <button key={v.name} className="btn sm ghost" onClick={() => setAccents(v.accents)}>{v.name}</button>)}
                    </div>
                  )}
                  <div>
                    <span className="label">Tempo: {bpm} pulsos/min</span>
                    <input type="range" className="range" min={40} max={260} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
                  </div>
                  <div className="row">
                    <button className="btn primary" onClick={playing ? stop : start}>{playing ? <><IconStop /> Parar</> : <><IconPlay /> Tocar compás</>}</button>
                    <button className="btn ghost sm" onClick={() => setBpm(Math.round(sel.bpm * 0.6))}>Lento para practicar</button>
                  </div>
                  {sel.sources && <div className="small muted">Fuente: {sel.sources.map((s) => <a key={s} href={s} target="_blank" rel="noreferrer">{s.replace('https://', '')}</a>)}</div>}
                </div>
              </div>
            </div>
            <div className="card">
              <h3>Lectura lineal</h3>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sel.beats}, 1fr)`, gap: 6 }}>
                {Array.from({ length: sel.beats }, (_, i) => (
                  <button key={i} onClick={() => toggleAccent(i + 1)} style={{
                    height: accents.includes(i + 1) ? 64 : 40, alignSelf: 'end', borderRadius: 8, border: '1px solid var(--line)', cursor: 'pointer',
                    background: beat === i ? 'var(--accent)' : accents.includes(i + 1) ? 'var(--accent-soft)' : 'var(--bg-2)',
                    color: beat === i ? '#1a1408' : 'var(--text)', fontWeight: 600, transition: 'background 0.06s' }}>{labelOf(i)}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Clock({ beats, accents, current, onToggle, labelOf }: {
  beats: number; accents: number[]; current: number; onToggle: (b: number) => void; labelOf: (i: number) => string
}) {
  const size = 300
  const c = size / 2
  const r = 112
  const pt = (i: number, rr = r) => {
    // El último tiempo (12 en flamenco) va arriba, como en el "reloj" que se usa para enseñar compás.
    const a = ((i + 1) / beats) * Math.PI * 2 - Math.PI / 2
    return [c + Math.cos(a) * rr, c + Math.sin(a) * rr]
  }
  const accPts = accents.map((a) => pt(a - 1).join(',')).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" />
      {accents.length > 2 && <polygon points={accPts} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.4} />}
      {current >= 0 && (() => { const [x, y] = pt(current, r - 26); return <line x1={c} y1={c} x2={x} y2={y} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" /> })()}
      <circle cx={c} cy={c} r={5} fill="var(--accent)" />
      {Array.from({ length: beats }, (_, i) => {
        const [x, y] = pt(i)
        const acc = accents.includes(i + 1)
        const on = current === i
        return (
          <g key={i} onClick={() => onToggle(i + 1)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r={acc ? 19 : 12} fill={on ? 'var(--accent)' : acc ? 'var(--surface-2)' : 'var(--bg-2)'}
                    stroke={acc ? 'var(--accent)' : 'var(--line)'} strokeWidth={acc ? 2 : 1} style={{ transition: 'fill 0.06s' }} />
            <text x={x} y={y + 4.5} textAnchor="middle" fontSize={acc ? 14 : 11} fontWeight={acc ? 700 : 500}
                  fill={on ? '#1a1408' : acc ? 'var(--accent)' : 'var(--text-2)'} style={{ pointerEvents: 'none' }}>{labelOf(i)}</text>
          </g>
        )
      })}
    </svg>
  )
}
