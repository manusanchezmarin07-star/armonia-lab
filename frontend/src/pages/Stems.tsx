import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Piano, { type Mark } from '../components/Piano'
import { IconPlay, IconStop, IconTrash } from '../components/Icons'
import { api } from '../lib/api'
import { useInput } from '../lib/input'
import { fnColor } from '../lib/music'

interface Segment { start: number; end: number; symbol: string; pcs: number[]; confidence: number; edited: boolean; roman?: string; function?: string | null; kind?: string }
interface Job {
  id: string; title: string; status: string; progress: number; message: string; separated: boolean; device: string | null
  stems: { id: string; name: string }[]
  analysis: { duration: number; tempo: number; key: string; segments: Segment[] } | null
}
interface Caps { demucs: boolean; models: Record<string, string>; device: string | null }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function Stems() {
  const [caps, setCaps] = useState<Caps | null>(null)
  const [jobs, setJobs] = useState<{ id: string; title: string; status: string }[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [model, setModel] = useState('htdemucs_6s')
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const refreshList = () => api.get<{ id: string; title: string; status: string }[]>('/api/stems').then(setJobs)
  useEffect(() => {
    api.get<Caps>('/api/stems/capabilities').then((c) => { setCaps(c); refreshList() }).catch(() => setUnavailable(true))
  }, [])

  // Sondeo mientras el trabajo está en marcha (la separación puede tardar minutos).
  useEffect(() => {
    if (!job || job.status === 'listo' || job.status === 'error') return
    const t = setInterval(() => api.get<Job>(`/api/stems/${job.id}`).then((j) => { setJob(j); if (j.status === 'listo') refreshList() }), 2000)
    return () => clearInterval(t)
  }, [job?.id, job?.status])

  const upload = async (file: File) => {
    setErr(null)
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('model', model)
    fd.append('separate', String(!!caps?.demucs))
    try {
      const r = await fetch('/api/stems', { method: 'POST', body: fd })
      if (!r.ok) throw new Error((await r.json()).detail)
      setJob(await r.json())
      refreshList()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  if (unavailable) {
    return (
      <div className="page fade-in">
        <div className="page-head"><div>
          <div className="eyebrow">Pistas</div>
          <h1>Separa una canción y saca sus acordes</h1>
        </div></div>
        <div className="card empty-state">
          <p style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--text)' }}>El módulo de pistas no está instalado</p>
          <p>Ejecuta <span className="kbd">INSTALAR.bat</span> sin la opción <span className="kbd">-SinPistas</span> para instalar Demucs y librosa.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Pistas</div>
          <h1>Separa una canción y saca sus acordes</h1>
          <p className="lead">Sube un audio. Demucs separa voz, bajo, piano, guitarra y batería en tu GPU, y yo detecto el pulso,
            la tonalidad y los acordes. Si me equivoco en un acorde, aísla la pista, ralentízala y tócalo en tu MIDI para corregirlo.</p>
        </div>
        {caps && (
          <span className={`pill ${caps.demucs ? 'teal' : 'accent'}`}>
            {caps.demucs ? `Demucs · ${caps.device}` : 'Sin Demucs: se analiza la mezcla completa'}
          </span>
        )}
      </div>

      <div className="grid grid-side-l" style={{ gridTemplateColumns: '280px minmax(0, 1fr)' }}>
        <div className="stack">
          <label className="card" data-tour="stems-upload" style={{ borderStyle: 'dashed', textAlign: 'center', cursor: 'pointer', padding: 26 }}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f) }}>
            <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{uploading ? 'Subiendo…' : 'Arrastra una canción'}</div>
            <div className="small muted">o haz clic · mp3, wav, m4a, flac</div>
          </label>
          {caps?.demucs && (
            <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
              {Object.entries(caps.models).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          {err && <div className="error">{err}</div>}
          <div className="card flush">
            <div className="nav-section" style={{ padding: '12px 16px 6px' }}>Canciones</div>
            {jobs.length === 0 && <div className="small muted" style={{ padding: '4px 16px 14px' }}>Aún no has subido ninguna.</div>}
            {jobs.map((j) => (
              <div key={j.id} className={`list-item ${job?.id === j.id ? 'on' : ''}`} style={{ padding: '9px 16px' }}
                   onClick={() => api.get<Job>(`/api/stems/${j.id}`).then(setJob)}>
                <div className="row"><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{j.title}</span>
                  <div className="spacer" /><span className="small muted">{j.status}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {!job && <div className="card empty-state">Sube una canción para empezar. Tus canciones se guardan solo en tu disco.</div>}
          {job && job.status !== 'listo' && (
            <div className="card fade-in">
              <h2>{job.title}</h2>
              {job.status === 'error' ? <div className="error">{job.message}</div> : (
                <>
                  <div className="row"><span className="pill accent">{job.status}</span><span className="small text-2">{job.message}</span></div>
                  <div style={{ height: 6, background: 'var(--bg-2)', borderRadius: 6, marginTop: 14, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(5, job.progress * 100)}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.6s' }} />
                  </div>
                </>
              )}
            </div>
          )}
          {job && job.status === 'listo' && job.analysis && (
            <Player key={job.id} job={job} onChange={setJob} onDelete={() => { api.del(`/api/stems/${job.id}`).then(() => { setJob(null); refreshList() }) }} />
          )}
        </div>
      </div>
    </div>
  )
}

function Player({ job, onChange, onDelete }: { job: Job; onChange: (j: Job) => void; onDelete: () => void }) {
  const { lastChord, pressed } = useInput()
  const audios = useRef<Record<string, HTMLAudioElement>>({})
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [rate, setRate] = useState(1)
  const [vol, setVol] = useState<Record<string, number>>({})
  const [muted, setMuted] = useState<Record<string, boolean>>({})
  const [solo, setSolo] = useState<string | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [loop, setLoop] = useState(false)
  const [fix, setFix] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const analysis = job.analysis!
  const segs = analysis.segments
  // Si hay pistas separadas, la mezcla original arranca silenciada para no duplicar el sonido.
  const stems = job.stems

  useEffect(() => {
    const map: Record<string, HTMLAudioElement> = {}
    stems.forEach((s) => {
      const a = new Audio(`/api/stems/${job.id}/audio/${s.id}`)
      a.preload = 'auto'
      a.preservesPitch = true // ralentizar sin cambiar el tono
      map[s.id] = a
    })
    audios.current = map
    const init: Record<string, boolean> = {}
    stems.forEach((s) => (init[s.id] = job.separated && s.id === 'mezcla'))
    setMuted(init)
    return () => Object.values(map).forEach((a) => { a.pause(); a.src = '' })
  }, [job.id])

  const master = () => audios.current[stems[0].id]

  // Bucle de animación: posición, bucle A-B y corrección de desfase entre pistas.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const m = master()
      if (m) {
        const t = m.currentTime
        setTime(t)
        if (loop && sel !== null && t >= segs[sel].end) seek(segs[sel].start)
        Object.values(audios.current).forEach((a) => { if (a !== m && Math.abs(a.currentTime - t) > 0.06) a.currentTime = t })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [loop, sel, job.id])

  useEffect(() => {
    stems.forEach((s) => {
      const a = audios.current[s.id]
      if (!a) return
      const audible = solo ? solo === s.id : !muted[s.id]
      a.volume = audible ? (vol[s.id] ?? 1) : 0
      a.playbackRate = rate
    })
  }, [vol, muted, solo, rate, job.id])

  const seek = useCallback((t: number) => { Object.values(audios.current).forEach((a) => (a.currentTime = t)); setTime(t) }, [])
  const toggle = () => {
    const all = Object.values(audios.current)
    if (playing) { all.forEach((a) => a.pause()); setPlaying(false) }
    else { const t = master().currentTime; all.forEach((a) => { a.currentTime = t; a.play() }); setPlaying(true) }
  }

  const curIdx = useMemo(() => segs.findIndex((s) => time >= s.start && time < s.end), [time, segs])
  const shown = sel ?? (curIdx >= 0 ? curIdx : null)
  const shownSeg = shown !== null ? segs[shown] : null
  const marks: Record<number, Mark> = {}
  shownSeg?.pcs.forEach((pc) => { marks[60 + pc] = 'target'; marks[48 + pc] = 'ghost' })

  const correct = async (body: { symbol?: string; notes?: number[] }) => {
    if (sel === null) return
    setMsg(null)
    try {
      const j = await api.put<Job>(`/api/stems/${job.id}/segments/${sel}`, body)
      onChange(j)
      setFix('')
      setMsg(`Corregido: ${j.analysis!.segments[sel].symbol}`)
    } catch (e) { setMsg((e as Error).message) }
  }

  const saveToLibrary = async () => {
    const { text } = await api.get<{ text: string }>(`/api/stems/${job.id}/progression`)
    await api.post('/api/library', { title: job.title, artist: 'Otro', key: analysis.key, progression: text, notes: `Tempo ≈ ${analysis.tempo} bpm`, source: 'pistas separadas + corrección MIDI' })
    setMsg('Guardado en tu biblioteca')
  }

  const dur = analysis.duration
  return (
    <div className="stack fade-in">
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{job.title}</h2>
          <span className="pill accent">{analysis.key.endsWith('m') ? analysis.key.slice(0, -1) + ' menor' : analysis.key + ' mayor'}</span>
          <span className="pill">≈ {Math.round(analysis.tempo)} bpm</span>
          <div className="spacer" />
          <button className="btn sm" onClick={saveToLibrary}>Guardar progresión</button>
          <button className="btn sm ghost" onClick={() => confirm('¿Borrar esta canción y sus pistas?') && onDelete()}><IconTrash /></button>
        </div>
        <div className="row mt">
          <button className="btn primary" onClick={toggle}>{playing ? <><IconStop /> Pausa</> : <><IconPlay /> Reproducir</>}</button>
          <span className="mono small text-2">{fmt(time)} / {fmt(dur)}</span>
          <input type="range" className="range" style={{ flex: 1 }} min={0} max={dur} step={0.1} value={time} onChange={(e) => seek(+e.target.value)} />
          <label className="small text-2 row" style={{ gap: 6 }}>Velocidad {Math.round(rate * 100)}%
            <input type="range" min={0.4} max={1} step={0.05} value={rate} onChange={(e) => setRate(+e.target.value)} />
          </label>
          <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} disabled={sel === null} /> Repetir acorde
          </label>
        </div>
        {/* Línea de tiempo de acordes, proporcional a la duración */}
        <div style={{ position: 'relative', marginTop: 16, height: 64, background: 'var(--bg-2)', borderRadius: 10, overflow: 'hidden' }}>
          {segs.map((s, i) => (
            <div key={i} onClick={() => { setSel(i); seek(s.start) }} title={`${s.symbol} ${s.roman ?? ''}`}
                 style={{ position: 'absolute', left: `${(s.start / dur) * 100}%`, width: `${((s.end - s.start) / dur) * 100}%`, top: 0, bottom: 0,
                   borderRight: '1px solid var(--bg)', cursor: 'pointer', padding: '6px 4px', overflow: 'hidden',
                   background: i === sel ? 'var(--accent-soft)' : i === curIdx ? 'var(--surface-2)' : 'transparent',
                   boxShadow: s.edited ? 'inset 0 -3px 0 var(--teal)' : `inset 0 3px 0 ${s.symbol === 'N' ? 'transparent' : fnColor(s.function)}`,
                   opacity: s.symbol === 'N' ? 0.4 : 0.55 + s.confidence * 0.45 }}>
              <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{s.symbol === 'N' ? '·' : s.symbol}</div>
              <div className="small" style={{ color: fnColor(s.function), whiteSpace: 'nowrap', fontSize: 11 }}>{s.roman ?? ''}</div>
            </div>
          ))}
          <div style={{ position: 'absolute', left: `${(time / dur) * 100}%`, top: 0, bottom: 0, width: 2, background: 'var(--accent)' }} />
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>Más opaco = más seguro · subrayado turquesa = corregido por ti</div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Mezclador</h3>
          {stems.map((s) => (
            <div key={s.id} className="row" style={{ padding: '6px 0' }}>
              <span style={{ width: 120 }}>{s.name}</span>
              <button className={`btn sm ${muted[s.id] ? '' : 'ghost'}`} style={{ width: 34, justifyContent: 'center', color: muted[s.id] ? 'var(--coral)' : undefined }}
                      onClick={() => setMuted((m) => ({ ...m, [s.id]: !m[s.id] }))} title="Silenciar">M</button>
              <button className="btn sm ghost" style={{ width: 34, justifyContent: 'center', color: solo === s.id ? 'var(--accent)' : undefined, borderColor: solo === s.id ? 'var(--accent)' : undefined }}
                      onClick={() => setSolo((x) => (x === s.id ? null : s.id))} title="Solo">S</button>
              <input type="range" className="range" style={{ flex: 1 }} min={0} max={1} step={0.01} value={vol[s.id] ?? 1}
                     onChange={(e) => setVol((v) => ({ ...v, [s.id]: +e.target.value }))} />
            </div>
          ))}
          {!job.separated && <p className="small muted">Sin Demucs solo está la mezcla. Instálalo para separar instrumentos.</p>}
        </div>

        <div className="card stack">
          <h3 style={{ margin: 0 }}>{sel !== null ? 'Acorde seleccionado' : 'Sonando ahora'}</h3>
          {shownSeg ? (
            <>
              <div className="row" style={{ alignItems: 'baseline' }}>
                <span className="chord-big" style={{ fontSize: 44 }}>{shownSeg.symbol === 'N' ? '—' : shownSeg.symbol}</span>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: fnColor(shownSeg.function) }}>{shownSeg.roman}</span>
                <div className="spacer" />
                <span className="pill">{fmt(shownSeg.start)}–{fmt(shownSeg.end)}</span>
                <span className={`pill ${shownSeg.confidence > 0.7 ? 'teal' : 'coral'}`}>{Math.round(shownSeg.confidence * 100)}% seguro</span>
              </div>
              <Piano from={48} to={83} marks={marks} height={95} />
              {sel !== null && (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="small text-2">¿No es correcto? Escúchalo en bucle con la pista aislada y:</div>
                  <div className="row">
                    <button className="btn primary sm" disabled={!(pressed.size ? pressed.size : lastChord.length) || (pressed.size || lastChord.length) < 2}
                            onClick={() => correct({ notes: pressed.size ? [...pressed] : lastChord })}>
                      Usar lo que he tocado en el MIDI {lastChord.length >= 2 && `(${lastChord.length} notas)`}
                    </button>
                    <input className="input" style={{ width: 120 }} placeholder="o escribe: Dm9" value={fix} onChange={(e) => setFix(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && fix.trim() && correct({ symbol: fix.trim() })} />
                    <button className="btn sm" disabled={!fix.trim()} onClick={() => correct({ symbol: fix.trim() })}>Aplicar</button>
                  </div>
                </div>
              )}
              {msg && <div className="small" style={{ color: 'var(--teal)' }}>{msg}</div>}
            </>
          ) : <p className="muted">Pulsa reproducir o elige un acorde en la línea de tiempo.</p>}
        </div>
      </div>
    </div>
  )
}
