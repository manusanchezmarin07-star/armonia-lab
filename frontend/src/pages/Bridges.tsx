import { useEffect, useState } from 'react'
import Piano, { type Mark } from '../components/Piano'
import KeySelect from '../components/KeySelect'
import CircleOfFifths from '../components/CircleOfFifths'
import { usePersistentState } from '../lib/prefs'
import { IconPlay, IconStop } from '../components/Icons'
import { api, type ModulationResult } from '../lib/api'
import { playChord, playSequence, stopSequence } from '../lib/audio'
import { midiName } from '../lib/music'

export default function Bridges() {
  const [from, setFrom] = usePersistentState('bridges.from', 'C')
  const [to, setTo] = usePersistentState('bridges.to', 'E')
  const [data, setData] = useState<ModulationResult | null>(null)
  const [sel, setSel] = useState(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setErr(null)
    api.post<ModulationResult>('/api/modulation', { from_key: from, to_key: to })
      .then((d) => { setData(d); setSel(0); setStep(0) }).catch((e) => setErr(e.message))
  }, [from, to])

  const route = data?.routes[sel]
  const cur = route?.steps[step]
  const prev = step > 0 ? route?.steps[step - 1] : undefined

  // Colores: turquesa = nota que se mantiene, coral = nota a la que se llega
  // moviéndose, ámbar = bajo; en gris claro las notas del acorde anterior.
  const marks: Record<number, Mark> = {}
  prev?.upper.forEach((m) => (marks[m] = 'ghost'))
  cur?.upper.forEach((m) => (marks[m] = prev ? (cur.held.includes(m) ? 'held' : 'move') : 'target'))
  if (cur) marks[cur.bass] = 'target'

  const play = () => {
    if (!route) return
    if (playing) { stopSequence(); setPlaying(false); return }
    setPlaying(true)
    playSequence(route.steps.map((s) => [s.bass, ...s.upper]), 1.5, setStep, () => setPlaying(false))
  }

  const pickStep = (i: number) => {
    setStep(i)
    const s = route!.steps[i]
    playChord([s.bass, ...s.upper], 1.4)
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Puentes</div>
          <h1>Cómo viajar entre tonalidades</h1>
          <p className="lead">Cada ruta es una forma distinta de cambiar de tonalidad. Las ordeno de más suave a más brusca
            según cuánto se mueven las voces. Fíjate en las notas <b style={{ color: 'var(--teal)' }}>turquesa</b>: se
            mantienen y son las que disimulan el cambio.</p>
        </div>
        <div className="row">
          <KeySelect value={from} onChange={setFrom} label="Desde" />
          <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => { setFrom(to); setTo(from) }} title="Intercambiar">⇄</button>
          <KeySelect value={to} onChange={setTo} label="Hasta" />
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {data && (
        <div className="grid grid-side-l">
          <div className="stack">
          <div className="card" data-tour="bridges-circle">
            <CircleOfFifths from={from} to={to} size={290} onPick={(k, w) => (w === 'from' ? setFrom(k) : setTo(k))} />
            <p className="small muted" style={{ margin: '8px 0 0', textAlign: 'center' }}>
              Clic: destino <span style={{ color: 'var(--accent)' }}>●</span> · Mayús+clic o clic derecho: origen <span style={{ color: 'var(--teal)' }}>●</span>
            </p>
          </div>
          <div className="card flush" data-tour="bridges-routes">
            <div style={{ padding: '16px 16px 8px' }} className="row">
              <h3 style={{ margin: 0 }}>Rutas</h3>
              <div className="spacer" />
              <span className="pill" title="Distancia en el círculo de quintas">
                {Math.abs(data.distance_fifths)} {Math.abs(data.distance_fifths) === 1 ? 'quinta' : 'quintas'} de distancia
              </span>
            </div>
            {data.routes.map((r, i) => (
              <div key={r.name} className={`list-item ${i === sel ? 'on' : ''}`} onClick={() => { stopSequence(); setPlaying(false); setSel(i); setStep(0) }}>
                <div className="row">
                  <b>{r.name}</b>
                  <div className="spacer" />
                  <span className="small muted mono">{r.avg_motion} st/paso</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (r.avg_motion / 12) * 100)}%`, height: '100%',
                    background: r.avg_motion <= 4 ? 'var(--teal)' : r.avg_motion <= 7 ? 'var(--accent)' : 'var(--coral)' }} />
                </div>
                <div className="small text-2" style={{ marginTop: 6 }}>{r.steps.map((s) => s.symbol).join(' → ')}</div>
              </div>
            ))}
          </div>
          </div>

          {route && cur && (
            <div className="stack">
              <div className="card" data-tour="bridges-detail">
                <div className="row" style={{ marginBottom: 14 }}>
                  <h2 style={{ margin: 0 }}>{route.name}</h2>
                  <div className="spacer" />
                  <button className="btn primary" onClick={play}>{playing ? <><IconStop /> Parar</> : <><IconPlay /> Reproducir</>}</button>
                </div>
                <p className="explain" style={{ marginTop: 0 }}>{route.explanation}</p>
                <div className="seq" style={{ margin: '16px 0' }}>
                  {route.steps.map((s, i) => (
                    <div key={i} style={{ display: 'contents' }}>
                      {i > 0 && <div className="seq-arrow">→</div>}
                      <div className={`seq-item ${i === step ? 'on' : ''}`} onClick={() => pickStep(i)}>
                        <div className="sym">{s.symbol}</div>
                        <div className="rn">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <Piano from={36} to={84} marks={marks} height={150} showNames />
                <div className="row small text-2" style={{ marginTop: 10, gap: 16 }}>
                  <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--teal)' }} /> se mantiene</span>
                  <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--coral)' }} /> se mueve</span>
                  <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--accent)' }} /> bajo / acorde inicial</span>
                  <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'rgba(232,176,75,0.35)' }} /> acorde anterior</span>
                </div>
              </div>
              {prev && (
                <div className="card fade-in" key={step}>
                  <h3>Qué pasa de {prev.symbol} a {cur.symbol}</h3>
                  <div className="row">
                    {cur.held.map((m) => <span key={m} className="pill teal">{midiName(m)} se queda</span>)}
                    {cur.moves.map((mv, i) => (
                      <span key={i} className="pill coral">{midiName(mv.from)} → {midiName(mv.to)} ({mv.semitones > 0 ? '+' : ''}{mv.semitones})</span>
                    ))}
                  </div>
                  <p className="small muted" style={{ marginBottom: 0 }}>Movimiento total de las voces: {cur.motion} semitonos.
                    Cuanto menos se mueven, menos "salto" percibe el oído.</p>
                </div>
              )}
              {data.pivots.length > 0 && (
                <div className="card">
                  <h3>Acordes pivote (comunes a ambas tonalidades)</h3>
                  <div className="row">
                    {data.pivots.map((p) => (
                      <div key={p.symbol} className="seq-item" style={{ cursor: 'default' }}>
                        <div className="sym" style={{ fontSize: 18 }}>{p.symbol}</div>
                        <div className="rn">{p.roman_from} → {p.roman_to}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
