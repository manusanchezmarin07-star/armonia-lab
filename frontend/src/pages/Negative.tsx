import { useEffect, useState } from 'react'
import Piano, { type Mark } from '../components/Piano'
import PcCircle from '../components/PcCircle'
import KeySelect from '../components/KeySelect'
import { IconPlay } from '../components/Icons'
import { api, type NegativeResult } from '../lib/api'
import { playChord, playSequence } from '../lib/audio'
import { fnColor } from '../lib/music'

const EXAMPLES = [
  { label: 'ii – V – I', text: 'Dm7 G7 Cmaj7', key: 'C' },
  { label: 'I – IV – V – I', text: 'C F G7 C', key: 'C' },
  { label: 'Cadena de dominantes', text: 'E7 A7 D7 G7 C', key: 'C' },
  { label: 'Pop (I–V–vi–IV)', text: 'C G Am F', key: 'C' },
]

export default function Negative() {
  const [key, setKey] = useState('C')
  const [text, setText] = useState('Dm7 G7 Cmaj7')
  const [data, setData] = useState<NegativeResult | null>(null)
  const [sel, setSel] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  const run = (t = text, k = key) => {
    setErr(null)
    api.post<NegativeResult>('/api/progression/negative', { text: t, key: k })
      .then((d) => { setData(d); setSel(0) }).catch((e) => setErr(e.message))
  }
  useEffect(() => { run() }, [])

  const pair = data?.pairs[sel]
  const tonicPc = data ? pcOfKey(key) : 0
  const marks: Record<number, Mark> = {}
  pair?.original_voicing.upper.forEach((m) => (marks[m] = 'target'))
  pair?.negative_voicing.upper.forEach((m) => (marks[m] = marks[m] ? 'held' : 'neg'))

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Armonía negativa</div>
          <h1>El espejo de la armonía</h1>
          <p className="lead">Cada nota se refleja sobre un eje situado entre la 3ª menor y la 3ª mayor de la tónica. Las
            tensiones se convierten en su reflejo "oscuro" pero conservan la función: el V7 sigue queriendo ir a la tónica,
            solo que desde abajo. Es el recurso que popularizó Jacob Collier, a partir de las ideas de Ernst Levy y Steve Coleman.</p>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <KeySelect value={key} onChange={(k) => { setKey(k); run(text, k) }} label="Tónica (eje)" />
          <label style={{ flex: 1, minWidth: 260 }}>
            <span className="label">Progresión (cifrado americano)</span>
            <input className="input" style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && run()} />
          </label>
          <button className="btn primary" onClick={() => run()}>Reflejar</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="small muted">Ejemplos:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} className="btn sm ghost" onClick={() => { setText(ex.text); setKey(ex.key); run(ex.text, ex.key) }}>{ex.label}</button>
          ))}
        </div>
      </div>
      {err && <div className="error mt">{err}</div>}

      {data && pair && (
        <div className="grid grid-side mt">
          <div className="stack">
            <div className="card">
              <div className="row" style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>Original → negativo</h3>
                <div className="spacer" />
                <button className="btn sm" onClick={() => playSequence(data.pairs.map((p) => [p.original_voicing.bass, ...p.original_voicing.upper]), 1.3, setSel)}>
                  <IconPlay /> Original
                </button>
                <button className="btn primary sm" onClick={() => playSequence(data.pairs.map((p) => [p.negative_voicing.bass, ...p.negative_voicing.upper]), 1.3, setSel)}>
                  <IconPlay /> Negativo
                </button>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {data.pairs.map((p, i) => (
                  <div key={i} className={`list-item ${i === sel ? 'on' : ''}`} style={{ borderRadius: 10, border: '1px solid var(--line-soft)' }}
                       onClick={() => setSel(i)}>
                    <div className="row">
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, minWidth: 90 }}>{p.original}</span>
                      <span className="small" style={{ color: fnColor(p.original_analysis.function), minWidth: 60 }}>{p.original_analysis.roman}</span>
                      <span className="muted">⟷</span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--violet)' }}>{p.negative}</span>
                      {p.alternatives.length > 0 && <span className="small muted">= {p.alternatives.join(' = ')}</span>}
                      <div className="spacer" />
                      <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); playChord([p.original_voicing.bass, ...p.original_voicing.upper]) }}>A</button>
                      <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); playChord([p.negative_voicing.bass, ...p.negative_voicing.upper]) }}>B</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <Piano from={36} to={84} marks={marks} height={140} showNames />
              <div className="row small text-2" style={{ marginTop: 10, gap: 16 }}>
                <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--accent)' }} /> {pair.original}</span>
                <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--violet)' }} /> {pair.negative} (reflejo exacto, en espejo)</span>
                <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--teal)' }} /> nota en ambos</span>
              </div>
              {pair.negative_mirrored_bass && pair.negative_mirrored_bass !== pair.negative && (
                <p className="small muted" style={{ marginBottom: 0 }}>Al reflejar también el bajo sale {pair.negative_mirrored_bass}.</p>
              )}
            </div>
          </div>
          <div className="card stack">
            <h3>El eje: {data.axis}</h3>
            <PcCircle pcs={pcsOf(pair.original_voicing.upper)} second={pcsOf(pair.negative_voicing.upper)} axis={tonicPc} root={tonicPc} size={270} />
            <p className="explain" style={{ margin: 0 }}>La línea discontinua es el espejo. Cada nota ámbar tiene su gemela violeta al otro lado:
              en {key.replace('m', '')} la tónica y la dominante se intercambian, igual que la 3ª mayor y la menor.</p>
            <p className="explain" style={{ margin: 0 }}><b>Por qué funciona:</b> {pair.original_analysis.explanation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

const pcsOf = (ms: number[]) => [...new Set(ms.map((m) => ((m % 12) + 12) % 12))]
function pcOfKey(k: string) {
  const name = k.endsWith('m') ? k.slice(0, -1) : k
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  let pc = base[name[0]]
  if (name.includes('#')) pc += 1
  if (name.includes('b')) pc -= 1
  return (pc + 12) % 12
}
