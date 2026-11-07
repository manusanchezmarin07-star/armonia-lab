import { useEffect, useMemo, useState } from 'react'
import ChordChip from '../components/ChordChip'
import KeySelect from '../components/KeySelect'
import { IconPlay } from '../components/Icons'
import { api, type VoicedStep } from '../lib/api'
import { playChord, playSequence, voicingNotes } from '../lib/audio'
import { usePersistentState } from '../lib/prefs'
import { fnColor, keyPc } from '../lib/music'

interface Sub {
  symbol: string; technique: string; explanation: string; common_tones: string[]; chain: string[]; roman: string
  melody?: { role: string; label: string | null; ok: boolean }; voicing: VoicedStep[]; motion_to_next: number | null
}
interface SubResult {
  original: { symbol: string; quality: string }; analysis: { roman: string; kind: string; function: string | null }
  substitutes: Sub[]; original_voicing: VoicedStep[]; original_melody: Sub['melody'] | null
}
interface MelodyResult { note: string; key: string; chords: { symbol: string; roman: string; kind: string; function: string | null; melody: { role: string; label: string } }[] }
interface ProgResult {
  style_description: string; motion_original: number; motion_reharmonized: number
  original: { symbol: string; voicing: VoicedStep }[]; reharmonized: { symbol: string; why: string; of: number; voicing: VoicedStep }[]
}

const NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const LABEL_ES: Record<string, string> = {
  '1': 'fundamental', '3': '3ª', b3: '3ª menor', '5': '5ª', b5: '5ª dis.', '#5': '5ª aum.', '6': '6ª', bb7: '7ª dis.', b7: '7ª',
  '7': '7ª mayor', '9': '9ª', b9: 'b9', '#9': '#9', '11': '11ª', '#11': '#11', '13': '13ª', b13: 'b13', '4': '4ª', '2': '2ª',
}

/** Toca la nota de la melodía una octava por encima del voicing para oír cómo encaja. */
function withMelody(notes: number[], melodyPc: number | null) {
  if (melodyPc === null) return notes
  const top = Math.max(...notes)
  let m = top + 1
  while (m % 12 !== melodyPc) m++
  return [...notes, m]
}

export default function Reharm() {
  const [tab, setTab] = usePersistentState<'acorde' | 'nota' | 'progresion'>('reharm.tab', 'acorde')
  const [key, setKey] = usePersistentState('key', 'C')
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Rearmonizar</div>
          <h1>¿Qué otro acorde podría ir aquí?</h1>
          <p className="lead">Los "cambios imposibles" de Jacob Collier suelen ser la misma melodía con otro acorde debajo. Aquí ves todas
            las sustituciones posibles con la regla que las justifica y lo suave que es cada una.</p>
        </div>
        <KeySelect value={key} onChange={setKey} label="Tonalidad" />
      </div>
      <div className="seg" style={{ marginBottom: 18 }}>
        <button className={tab === 'acorde' ? 'on' : ''} onClick={() => setTab('acorde')}>Sustituir un acorde</button>
        <button className={tab === 'nota' ? 'on' : ''} onClick={() => setTab('nota')}>Armonizar una nota</button>
        <button className={tab === 'progresion' ? 'on' : ''} onClick={() => setTab('progresion')}>Rearmonizar progresión</button>
      </div>
      {tab === 'acorde' && <SubstituteTab k={key} />}
      {tab === 'nota' && <MelodyTab k={key} />}
      {tab === 'progresion' && <ProgressionTab k={key} />}
    </div>
  )
}

function SubstituteTab({ k }: { k: string }) {
  const [chord, setChord] = usePersistentState('reharm.chord', 'G7')
  const [next, setNext] = usePersistentState('reharm.next', 'Cmaj7')
  const [melody, setMelody] = usePersistentState('reharm.melody', '')
  const [data, setData] = useState<SubResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const melodyPc = melody ? keyPc(melody) : null

  const run = () => {
    setErr(null)
    api.post<SubResult>('/api/reharm/substitutes', { chord, key: k, next_chord: next || null, melody: melody || null })
      .then(setData).catch((e) => { setData(null); setErr(e.message) })
  }
  useEffect(run, [k])

  const groups = useMemo(() => {
    const m = new Map<string, Sub[]>()
    data?.substitutes.forEach((s) => {
      const g = s.technique.startsWith('Preparar') || s.technique.includes('aproximación') ? 'Preparaciones (se insertan antes)' : 'Sustituciones'
      m.set(g, [...(m.get(g) ?? []), s])
    })
    return [...m.entries()]
  }, [data])

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label><span className="label">Acorde original</span><input className="input chord-input" value={chord} onChange={(e) => setChord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} /></label>
          <label><span className="label">Va hacia (opcional)</span><input className="input chord-input" value={next} onChange={(e) => setNext(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} /></label>
          <label><span className="label">Nota de la melodía (opcional)</span>
            <select className="select" value={melody} onChange={(e) => setMelody(e.target.value)}>
              <option value="">—</option>{NOTES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn primary" onClick={run}>Buscar sustitutos</button>
        </div>
        {err && <div className="error mt">{err}</div>}
      </div>

      {data && (
        <>
          <div className="card row fade-in" style={{ alignItems: 'center' }}>
            <span className="chord-big" style={{ fontSize: 40 }}>{data.original.symbol}</span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: fnColor(data.analysis.function) }}>{data.analysis.roman}</span>
            <span className="pill violet">{data.analysis.kind}</span>
            {data.original_melody && <span className={`pill ${data.original_melody.ok ? 'teal' : 'coral'}`}>melodía: {data.original_melody.role}</span>}
            <div className="spacer" />
            <button className="btn" onClick={() => playSequence(data.original_voicing.map((v) => withMelody(voicingNotes(v), melodyPc)), 1.4)}>
              <IconPlay /> Original{next ? ` → ${next}` : ''}
            </button>
          </div>
          {groups.map(([g, list]) => (
            <div key={g}>
              <h3 style={{ margin: '8px 0 10px' }}>{g}</h3>
              <div className="grid grid-3">
                {list.map((s) => (
                  <div key={s.symbol} className="card stack fade-in" style={{ gap: 8 }}>
                    <div className="row">
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600 }}>{s.symbol}</span>
                      <div className="spacer" />
                      <button className="btn sm primary" title="Escuchar"
                              onClick={() => playSequence(s.voicing.map((v) => withMelody(voicingNotes(v), melodyPc)), 1.4)}><IconPlay /></button>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="pill accent">{s.technique}</span>
                      <span className="pill">{s.roman}</span>
                      {s.motion_to_next !== null && (
                        <span className={`pill ${s.motion_to_next <= 4 ? 'teal' : s.motion_to_next <= 7 ? '' : 'coral'}`}>{s.motion_to_next} st hasta {next}</span>
                      )}
                      {s.melody && <span className={`pill ${s.melody.ok ? 'teal' : 'coral'}`}>melodía = {s.melody.label ? LABEL_ES[s.melody.label] ?? s.melody.label : s.melody.role}</span>}
                    </div>
                    <p className="explain small" style={{ margin: 0 }}>{s.explanation}</p>
                    {s.common_tones.length > 0 && <div className="small muted">Notas comunes con {data.original.symbol}: {s.common_tones.join(', ')}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function MelodyTab({ k }: { k: string }) {
  const [note, setNote] = usePersistentState('reharm.note', 'E')
  const [data, setData] = useState<MelodyResult | null>(null)
  useEffect(() => { api.post<MelodyResult>('/api/reharm/melody', { note, key: k }).then(setData) }, [note, k])
  const pc = keyPc(note)
  const groups = useMemo(() => {
    const m = new Map<string, MelodyResult['chords']>()
    data?.chords.forEach((c) => m.set(c.kind, [...(m.get(c.kind) ?? []), c]))
    return [...m.entries()]
  }, [data])

  const play = async (symbol: string) => {
    const r = await api.get<{ voicing: VoicedStep }>(`/api/chords/parse?symbol=${encodeURIComponent(symbol)}`)
    playChord(withMelody(voicingNotes(r.voicing), pc), 2)
  }

  return (
    <div className="stack">
      <div className="card">
        <span className="label">Nota de la melodía</span>
        <div className="seg">{NOTES.map((n) => <button key={n} className={n === note ? 'on' : ''} onClick={() => setNote(n)}>{n}</button>)}</div>
        <p className="small text-2" style={{ marginBottom: 0 }}>Todos estos acordes pueden ir debajo de {note}. Pulsa uno para oírlo con la melodía arriba.
          Empieza por los de casa (diatónicos) y aventúrate hacia los lejanos: así se rearmoniza una melodía.</p>
      </div>
      {groups.map(([kind, list]) => (
        <div key={kind} className="card">
          <h3>{kind}</h3>
          <div className="row">
            {list.map((c) => (
              <ChordChip key={c.symbol} small symbol={c.symbol} fn={c.function} onClick={() => play(c.symbol)}
                         sub={`${c.roman} · ${note}=${LABEL_ES[c.melody.label] ?? c.melody.label}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProgressionTab({ k }: { k: string }) {
  const [text, setText] = usePersistentState('reharm.prog', 'Cmaj7 Am7 Dm7 G7 Cmaj7')
  const [style, setStyle] = usePersistentState('reharm.style', 'negativa')
  const [styles, setStyles] = useState<Record<string, string>>({})
  const [data, setData] = useState<ProgResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [cur, setCur] = useState<[number, number]>([-1, -1])

  useEffect(() => { api.get<Record<string, string>>('/api/reharm/styles').then(setStyles) }, [])
  const run = () => {
    setErr(null)
    api.post<ProgResult>('/api/reharm/progression', { text, key: k, style }).then(setData).catch((e) => { setData(null); setErr(e.message) })
  }
  useEffect(run, [k, style])

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label style={{ flex: 1, minWidth: 260 }}><span className="label">Progresión</span>
            <input className="input chord-input" style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
          </label>
          <div>
            <span className="label">Estilo</span>
            <div className="seg">{Object.keys(styles).map((s) => <button key={s} className={s === style ? 'on' : ''} onClick={() => setStyle(s)}>{s}</button>)}</div>
          </div>
          <button className="btn primary" onClick={run}>Rearmonizar</button>
        </div>
        {styles[style] && <p className="small text-2" style={{ marginBottom: 0 }}>{styles[style]}</p>}
        {err && <div className="error mt">{err}</div>}
      </div>
      {data && (
        <div className="card stack fade-in">
          <div className="row">
            <h3 style={{ margin: 0 }}>Original</h3><div className="spacer" />
            <span className="small muted">movimiento de voces: {data.motion_original} st</span>
            <button className="btn sm" onClick={() => playSequence(data.original.map((o) => voicingNotes(o.voicing)), 1.3, (i) => setCur([i, -1]), () => setCur([-1, -1]))}><IconPlay /> Escuchar</button>
          </div>
          <div className="seq">{data.original.map((o, i) => <ChordChip key={i} small symbol={o.symbol} active={cur[0] === i} />)}</div>
          <div className="row mt">
            <h3 style={{ margin: 0 }}>Rearmonizada</h3><div className="spacer" />
            <span className="small muted">movimiento de voces: {data.motion_reharmonized} st</span>
            <button className="btn sm primary" onClick={() => playSequence(data.reharmonized.map((o) => voicingNotes(o.voicing)), 1.3, (i) => setCur([-1, i]), () => setCur([-1, -1]))}><IconPlay /> Escuchar</button>
          </div>
          <div className="seq">
            {data.reharmonized.map((o, i) => (
              <ChordChip key={i} small symbol={o.symbol} active={cur[1] === i} sub={o.why || 'igual'} title={o.why}
                         fn={o.why ? 'X' : undefined} onClick={() => playChord(voicingNotes(o.voicing))} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
