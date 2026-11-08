import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Piano, { type Mark } from '../components/Piano'
import KeySelect from '../components/KeySelect'
import PracticeBar from '../components/PracticeBar'
import { useToast } from '../components/Toast'
import { api, type ProgressionAnalysis } from '../lib/api'
import { playChord, voicingNotes } from '../lib/audio'
import { ARTISTS, KEYS, fnColor, keyLabel } from '../lib/music'


export default function Analyzer() {
  const [params] = useSearchParams()
  const [text, setText] = useState(params.get('p') ?? 'Cmaj7 A7 Dm7 G7 Em7 A7 Dm7 Db7 Cmaj7 Cm7 F7 Bbmaj7 Ebmaj7 Abmaj7 G7 C')
  const [key, setKey] = useState(params.get('k') ?? '')
  const [data, setData] = useState<ProgressionAnalysis | null>(null)
  const [sel, setSel] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  const run = (t = text, k = key) => {
    setErr(null)
    api.post<ProgressionAnalysis>('/api/progression/analyze', { text: t, key: k || null })
      .then((d) => { setData(d); setSel(0) }).catch((e) => { setData(null); setErr(e.message) })
  }
  useEffect(() => run(), [])

  const cur = data?.chords[sel]
  const marks: Record<number, Mark> = {}
  cur?.voicing.upper.forEach((m) => (marks[m] = 'target'))
  if (cur) marks[cur.voicing.bass] = 'held'

  // Transporte: si se conoce la tonalidad (indicada o detectada) se transporta por
  // tonalidades para deletrear bien; si no, por semitonos.
  const transpose = async (body: { semitones?: number; to_key?: string }) => {
    const from = key || data?.key ? (key || keyFromName(data!.key)) : undefined
    const r = await api.post<{ text: string }>('/api/progression/transpose', { text, from_key: body.to_key ? from : undefined, ...body })
    setText(r.text)
    if (body.to_key) setKey(body.to_key)
    else if (key) setKey('')
    run(r.text, body.to_key ?? (key ? '' : key))
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Analizador</div>
          <h1>Desmonta una progresión</h1>
          <p className="lead">Escribe los acordes de una canción. Te doy el grado de cada uno, su función, los acordes
            "prestados" o de paso y dónde cambia la tonalidad. Si no indicas tonalidad, la deduzco yo.</p>
        </div>
      </div>
      <div className="card" data-tour="analyzer-input">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label style={{ flex: 1, minWidth: 280 }}>
            <span className="label">Progresión (separa con espacios o |)</span>
            <textarea className="input" rows={2} style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--serif)', fontSize: 17 }}
                      value={text} onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run() } }} />
          </label>
          <KeySelect value={key} onChange={setKey} allowNone label="Tonalidad" />
          <button className="btn primary" onClick={() => run()}>Analizar</button>
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Admite: C, Cm, C7, Cmaj7 / C∆7, Cm7, Cm7b5 / Cø, Cdim7 / C°7, C9, C13, C7(b9,#11), C7alt, C6/9, Csus4, C/E…
        </p>
      </div>
      {err && <div className="error mt">{err}</div>}

      {data && (
        <div className="stack mt fade-in">
          <div className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Tonalidad inicial: <span style={{ color: 'var(--text)' }}>{data.key}</span></h3>
              {data.modulations.map((m, i) => (
                <span key={i} className="pill violet">compás {m.at + 1}: modula a {m.to}{m.pivot ? ` (pivote ${m.pivot})` : ''}</span>
              ))}
              <div className="spacer" />
              <button className="btn sm" onClick={() => setSaveOpen((v) => !v)}>Guardar en biblioteca</button>
              <select className="select" style={{ padding: '6px 28px 6px 10px' }} value="" title="Transportar"
                      onChange={(e) => e.target.value && transpose({ to_key: e.target.value })}>
                <option value="">Transportar a…</option>
                {KEYS.map((k) => <option key={k} value={k}>{keyLabel(k)}</option>)}
              </select>
              <button className="btn sm" title="Bajar medio tono" onClick={() => transpose({ semitones: -1 })}>−½</button>
              <button className="btn sm" title="Subir medio tono" onClick={() => transpose({ semitones: 1 })}>+½</button>
            </div>
            <div style={{ marginBottom: 14 }} data-tour="analyzer-practice">
              <PracticeBar chords={data.chords.map((c) => voicingNotes(c.voicing))} name={text.slice(0, 40)} onChord={setSel} />
            </div>
            {saveOpen && <SaveForm text={text} keyText={key || null} onDone={() => setSaveOpen(false)} />}
            <div className="seq">
              {data.chords.map((c, i) => {
                const mod = data.modulations.find((m) => m.at === i)
                return (
                  <div key={i} style={{ display: 'contents' }}>
                    {mod && <div className="mod-marker"><span>→ {mod.to}</span></div>}
                    <div className={`seq-item ${i === sel ? 'on' : ''}`} onClick={() => { setSel(i); playChord([c.voicing.bass, ...c.voicing.upper]) }}>
                      <div className="fn" style={{ background: fnColor(c.analysis.function) }} />
                      <div className="sym">{c.symbol}</div>
                      <div className="rn" style={{ color: fnColor(c.analysis.function) }}>{c.analysis.roman}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="row small text-2" style={{ marginTop: 14, gap: 16 }}>
              <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--fn-t)' }} /> Tónica</span>
              <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--fn-s)' }} /> Subdominante</span>
              <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--fn-d)' }} /> Dominante</span>
              <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--violet)' }} /> Color / sin función clara</span>
            </div>
          </div>
          {cur && (
            <div className="grid grid-2">
              <div className="card fade-in" key={sel}>
                <div className="row" style={{ alignItems: 'baseline' }}>
                  <div className="chord-big" style={{ fontSize: 48 }}>{cur.symbol}</div>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 26, color: fnColor(cur.analysis.function) }}>{cur.analysis.roman}</span>
                </div>
                <div className="row" style={{ margin: '12px 0' }}>
                  <span className="pill violet">{cur.analysis.kind}</span>
                  <span className="pill">{cur.key}</span>
                  <span className="pill">{cur.notes.join(' · ')}</span>
                </div>
                <p className="explain" style={{ margin: 0 }}>{cur.analysis.explanation}</p>
              </div>
              <div className="card">
                <Piano from={36} to={84} marks={marks} height={130} showNames />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SaveForm({ text, keyText, onDone }: { text: string; keyText: string | null; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState(ARTISTS[0])
  const [notes, setNotes] = useState('')
  const toast = useToast()
  const save = () => api.post('/api/library', { title: title || 'Sin título', artist, key: keyText, progression: text, notes, source: 'transcripción propia' })
    .then(() => { toast('Guardado en tu biblioteca'); onDone() }).catch((e) => toast(e.message, 'error'))
  return (
    <div className="row fade-in" style={{ marginBottom: 16, padding: 14, background: 'var(--bg-2)', borderRadius: 12 }}>
      <input className="input" placeholder="Título (canción y sección)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select className="select" value={artist} onChange={(e) => setArtist(e.target.value)}>{ARTISTS.map((a) => <option key={a}>{a}</option>)}</select>
      <input className="input" style={{ flex: 1 }} placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn primary sm" onClick={save}>Guardar</button>
    </div>
  )
}

/** "Eb mayor" / "C# menor" (formato del backend) → "Eb" / "C#m". */
function keyFromName(name: string) {
  const [tonic, mode] = name.split(' ')
  return tonic + (mode === 'menor' ? 'm' : '')
}
