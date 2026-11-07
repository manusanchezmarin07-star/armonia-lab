import { useEffect, useMemo, useRef, useState } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import Piano, { type Mark } from '../components/Piano'
import { IconPlay, IconStop } from '../components/Icons'
import { api } from '../lib/api'
import { Tone, ensureAudio } from '../lib/audio'
import { fnColor } from '../lib/music'

interface ChoraleItem { id: string; title: string }
interface BachChord {
  t: number; d: number; measure: number; midi: number[]; symbol: string | null; roman: string | null
  m21_roman: string | null; kind: string; function: string | null; explanation: string
}
interface Chorale {
  id: string; title: string; key: string; key_name: string; musicxml: string
  voices: { name: string; notes: { t: number; d: number; m: number }[] }[]; chords: BachChord[]
}

const VOICE_COLORS = ['var(--accent)', 'var(--teal)', 'var(--violet)', 'var(--coral)']

export default function Bach() {
  const [list, setList] = useState<ChoraleItem[]>([])
  const [q, setQ] = useState('')
  const [id, setId] = useState('bwv66.6')
  const [data, setData] = useState<Chorale | null>(null)
  const [cur, setCur] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [bpm, setBpm] = useState(66)
  const [muted, setMuted] = useState<boolean[]>([false, false, false, false])
  const scoreRef = useRef<HTMLDivElement>(null)
  const partRef = useRef<Tone.Part | null>(null)

  useEffect(() => { api.get<ChoraleItem[]>('/api/bach/chorales').then(setList) }, [])
  useEffect(() => {
    stop()
    setData(null)
    api.get<Chorale>(`/api/bach/chorales/${id}`).then((d) => { setData(d); setCur(0) })
  }, [id])

  useEffect(() => {
    if (!data || !scoreRef.current) return
    scoreRef.current.innerHTML = ''
    const osmd = new OpenSheetMusicDisplay(scoreRef.current, { autoResize: true, drawTitle: false, drawPartNames: true,
      drawingParameters: 'compacttight' })
    osmd.load(data.musicxml).then(() => osmd.render()).catch(() => {})
  }, [data])

  const stop = () => {
    partRef.current?.dispose()
    partRef.current = null
    Tone.getTransport().stop()
    Tone.getTransport().cancel()
    setPlaying(false)
  }

  // Se reproduce con Tone.Part (reloj de audio) para que las 4 voces vayan
  // exactamente juntas; la animación se sincroniza con Tone.Draw.
  const play = async () => {
    if (!data) return
    if (playing) return stop()
    const inst = await ensureAudio()
    const spq = 60 / bpm
    const events: { time: number; m: number; d: number; v: number }[] = []
    data.voices.forEach((v, vi) => {
      if (muted[vi]) return
      v.notes.forEach((n) => events.push({ time: n.t * spq, m: n.m, d: n.d * spq * 0.95, v: vi }))
    })
    const part = new Tone.Part((time, ev: { m: number; d: number }) => {
      inst.triggerAttackRelease(Tone.Frequency(ev.m, 'midi').toFrequency(), ev.d, time, 0.6)
    }, events.map((e) => [e.time, e] as [number, typeof e]))
    data.chords.forEach((c, i) => Tone.getTransport().schedule((time) => Tone.getDraw().schedule(() => setCur(i), time), c.t * spq))
    const end = Math.max(...data.chords.map((c) => (c.t + c.d) * spq))
    Tone.getTransport().schedule((time) => Tone.getDraw().schedule(() => stop(), time), end + 0.5)
    part.start(0)
    partRef.current = part
    Tone.getTransport().position = 0
    Tone.getTransport().start('+0.05')
    setPlaying(true)
  }
  useEffect(() => () => stop(), [])

  const filtered = useMemo(() => list.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())), [list, q])
  const chord = data?.chords[cur]
  const marks: Record<number, Mark> = {}
  chord?.midi.forEach((m, i) => (marks[m] = i === 0 ? 'held' : 'target'))

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Estudio de genios · J. S. Bach</div>
          <h1>Los corales de Bach, acorde a acorde</h1>
          <p className="lead">Las partituras originales del corpus de music21 (dominio público). Cada acorde lleva su análisis
            y, al lado, la cifra que da music21 como segunda opinión. Silencia voces para escuchar cómo se mueve cada una.</p>
        </div>
      </div>
      <div className="grid grid-side-l" style={{ gridTemplateColumns: '240px minmax(0, 1fr)' }}>
        <div className="card flush" style={{ maxHeight: 820, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12 }}><input className="input" style={{ width: '100%' }} placeholder="Buscar BWV…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ overflowY: 'auto' }}>
            {filtered.map((c) => (
              <div key={c.id} className={`list-item ${c.id === id ? 'on' : ''}`} style={{ padding: '8px 16px' }} onClick={() => setId(c.id)}>{c.title}</div>
            ))}
          </div>
        </div>

        {!data ? <div className="card empty-state">Cargando partitura…</div> : (
          <div className="stack fade-in">
            <div className="card">
              <div className="row">
                <h2 style={{ margin: 0 }}>{data.title}</h2>
                <span className="pill accent">{data.key_name}</span>
                <div className="spacer" />
                {data.voices.map((v, i) => (
                  <button key={i} className="btn sm" style={{ opacity: muted[i] ? 0.4 : 1, borderColor: VOICE_COLORS[i] }}
                          onClick={() => setMuted((m) => m.map((x, j) => (j === i ? !x : x)))} title="Silenciar / activar voz">
                    {v.name.slice(0, 1) || 'V'}
                  </button>
                ))}
                <label className="small text-2 row" style={{ gap: 6 }}>♩={bpm}
                  <input type="range" min={30} max={120} value={bpm} onChange={(e) => setBpm(+e.target.value)} disabled={playing} />
                </label>
                <button className="btn primary" onClick={play}>{playing ? <><IconStop /> Parar</> : <><IconPlay /> Escuchar</>}</button>
              </div>
              <div className="seq mt" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 8 }}>
                {data.chords.map((c, i) => (
                  <div key={i} className={`seq-item ${i === cur ? 'on' : ''}`} style={{ minWidth: 76, padding: '10px 10px' }}
                       ref={(el) => { if (el && i === cur && playing) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }) }}
                       onClick={() => { setCur(i); ensureAudio().then((inst) => c.midi.forEach((m) => inst.triggerAttackRelease(Tone.Frequency(m, 'midi').toFrequency(), 1.2))) }}>
                    <div className="fn" style={{ background: fnColor(c.function) }} />
                    <div className="small muted">c. {c.measure}</div>
                    <div className="sym" style={{ fontSize: 17 }}>{c.symbol ?? '·'}</div>
                    <div className="rn" style={{ color: fnColor(c.function) }}>{c.roman ?? ''}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-2">
              <div className="card">
                <Piano from={36} to={84} marks={marks} height={120} showNames />
              </div>
              {chord && (
                <div className="card fade-in" key={cur}>
                  <div className="row">
                    <span className="chord-big" style={{ fontSize: 40 }}>{chord.symbol ?? '—'}</span>
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: fnColor(chord.function) }}>{chord.roman}</span>
                    <div className="spacer" />
                    {chord.m21_roman && <span className="pill" title="Segunda opinión de music21">music21: {chord.m21_roman}</span>}
                  </div>
                  <div className="row" style={{ margin: '8px 0' }}><span className="pill violet">{chord.kind}</span><span className="pill">compás {chord.measure}</span></div>
                  <p className="explain" style={{ margin: 0 }}>{chord.explanation}</p>
                </div>
              )}
            </div>
            <div className="card" style={{ background: '#f6f1e7', padding: 12 }}>
              <div ref={scoreRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
