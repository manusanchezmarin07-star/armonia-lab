import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Keys from '../components/Keys'
import type { Mark } from '../components/Piano'
import { IconPlay, IconStop, IconTrash } from '../components/Icons'
import { api } from '../lib/api'
import { useInput } from '../lib/input'
import { fnColor } from '../lib/music'
import LyricsSheet from '../components/LyricsSheet'
import SongTutorial from '../components/SongTutorial'
import GuitarSongTutorial from '../components/GuitarSongTutorial'
import { useInstrument } from '../lib/instrument'
import { SongPlayer, trackGains } from '../lib/multitrack'
import Mixer, { type Instrument, type StemInfo } from '../components/Mixer'
import ChordChart from '../components/ChordChart'
import { usePersistentState } from '../lib/prefs'

interface Segment { start: number; end: number; symbol: string; pcs: number[]; confidence: number; edited: boolean; roman?: string; function?: string | null; kind?: string; alternatives?: string[] }
interface Job {
  id: string; title: string; status: string; progress: number; message: string; separated: boolean; device: string | null
  source?: { kind: string; url?: string; uploader?: string }
  stems: StemInfo[]
  instruments?: Instrument[]; instruments_method?: string; instruments_status?: string; instruments_error?: string
  multitrack?: { file: string; channels: number; layout: { id: string; channels: number[] }[] }
  warning?: string | null
  analysis: { duration: number; tempo: number; key: string; segments: Segment[]; beats?: number[]; method?: string } | null
  lyrics_status?: string; lyrics_error?: string; validated?: boolean
  lyrics?: { source: string; lines: { start: number; end: number; words: { text: string; start: number; end: number }[] }[]; text?: string }
}
interface Caps { demucs: boolean; models: Record<string, string>; device: string | null; youtube?: boolean; ffmpeg?: boolean }

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
    if (!job) return
    const working = job.status !== 'listo' && job.status !== 'error'
    // La canción ya se puede usar mientras se reconocen los instrumentos: se sigue
    // consultando (más despacio) para actualizar los nombres de las pistas cuando acabe.
    const tagging = job.status === 'listo' && job.instruments_status === 'analizando'
    if (!working && !tagging) return
    const t = setInterval(() => api.get<Job>(`/api/stems/${job.id}`).then((j) => {
      // Mientras solo se etiquetan instrumentos no se toca la ficha salvo que cambie algo:
      // así no se pisan las correcciones que el usuario esté haciendo.
      if (working || j.instruments_status !== 'analizando') setJob(j)
      if (working && j.status === 'listo') refreshList()
    }).catch(() => {}), working ? 1500 : 4000)
    return () => clearInterval(t)
  }, [job?.id, job?.status, job?.instruments_status])

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

  const [url, setUrl] = useState('')
  const importUrl = async () => {
    if (!url.trim()) return
    setErr(null)
    setUploading(true)
    try {
      setJob(await api.post<Job>('/api/stems/from-url', { url: url.trim(), model, separate: !!caps?.demucs }))
      setUrl('')
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
          <p className="lead">Sube un audio o pega un enlace de YouTube. Demucs separa voz, bajo, piano, guitarra y batería en tu GPU, y yo detecto el pulso,
            la tonalidad y los acordes. Si me equivoco en un acorde, aísla la pista, ralentízala y tócalo en tu MIDI para corregirlo.</p>
        </div>
        {caps && (
          <span className={`pill ${caps.demucs ? 'teal' : 'accent'}`}>
            {caps.demucs ? `Demucs · ${caps.device}` : 'Sin Demucs: se analiza la mezcla completa'}
          </span>
        )}
      </div>

      <div className="grid grid-side-l" style={{ ['--side' as string]: '280px' }}>
        <div className="stack">
          <label className="card" data-tour="stems-upload" style={{ borderStyle: 'dashed', textAlign: 'center', cursor: 'pointer', padding: 26 }}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f) }}>
            <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{uploading ? 'Subiendo…' : 'Arrastra una canción'}</div>
            <div className="small muted">o haz clic · mp3, wav, m4a, flac</div>
          </label>
          {caps?.youtube && (
            <div className="card stack" style={{ gap: 8, padding: 14 }} data-tour="stems-youtube">
              <label className="small text-2" htmlFor="yt-url">…o pega un enlace de YouTube</label>
              <input id="yt-url" className="input" placeholder="https://youtu.be/…" value={url} onChange={(e) => setUrl(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && importUrl()} />
              <button className="btn" disabled={!url.trim() || uploading} onClick={importUrl}>Importar y analizar</button>
              <div className="small muted">Solo para tu estudio: el audio se queda en tu disco. Vídeos de hasta 20 min.
                {caps.ffmpeg === false && ' Necesita ffmpeg instalado.'}</div>
            </div>
          )}
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
              {job.status === 'error' ? (
                <div className="stack">
                  <div className="error">{job.message}</div>
                  <div className="row">
                    <button className="btn primary" onClick={() => api.post<Job>(`/api/stems/${job.id}/retry`, {}).then((j) => { setJob(j); refreshList() }).catch((e) => setErr((e as Error).message))}>Reintentar</button>
                    <button className="btn ghost" onClick={() => api.del(`/api/stems/${job.id}`).then(() => { setJob(null); refreshList() })}>Borrar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row"><span className="pill accent">{job.status}</span><span className="small text-2">{job.message}</span>
                    <div className="spacer" /><span className="mono small text-2">{Math.round(job.progress * 100)} %</span></div>
                  <div className="progress" role="progressbar" aria-valuenow={Math.round(job.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <div style={{ width: `${Math.max(3, job.progress * 100)}%` }} />
                  </div>
                  <div className="steps-row">
                    {[...(job.source?.kind === 'youtube' ? ['descargando'] : []), 'preparando audio', ...(job.separated || job.device ? ['separando pistas'] : []), 'analizando acordes', 'preparando el reproductor'].map((st, i, all) => {
                      const cur = all.indexOf(job.status)
                      return <span key={st} className={i < cur ? 'done' : i === cur ? 'on' : ''}>{i < cur ? '✓ ' : ''}{st}</span>
                    })}
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
  const player = useRef<SongPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [audioErr, setAudioErr] = useState<string | null>(null)
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
  const [tab, setTab] = usePersistentState<'acordes' | 'letra' | 'tutorial'>('stems.tab', 'acordes')
  const { isGuitar } = useInstrument()
  const analysis = job.analysis!
  const segs = analysis.segments
  // Con pistas separadas se reproduce el multipista (la «mezcla original» es la suma de
  // todas, así que no hace falta como pista aparte); sin separar, solo está la mezcla.
  const stems = useMemo(() => job.stems.filter((st) => (job.separated ? st.id !== 'mezcla' : st.id === 'mezcla')), [job.stems, job.separated])
  const layoutKey = JSON.stringify(job.multitrack?.layout ?? null)

  // Las canciones separadas con versiones anteriores no tienen multipista: se pide (el
  // servidor lo crea la primera vez) y se recarga la ficha para saber qué canal es cada pista.
  useEffect(() => {
    if (!job.separated || job.multitrack) return
    let live = true
    fetch(`/api/stems/${job.id}/multitrack`, { headers: { Range: 'bytes=0-1' } })
      .then((r) => { if (!r.ok) throw new Error('No se pudieron preparar las pistas de esta canción') })
      .then(() => api.get<Job>(`/api/stems/${job.id}`)).then((j) => live && onChange(j))
      .catch((e) => live && setAudioErr((e as Error).message))
    return () => { live = false }
  }, [job.id, job.separated, !!job.multitrack])

  useEffect(() => {
    if (job.separated && !job.multitrack) return
    const mt = job.multitrack
    const p = mt
      ? new SongPlayer(`/api/stems/${job.id}/multitrack`, mt.layout, mt.channels)
      : new SongPlayer(`/api/stems/${job.id}/audio/mezcla`, [{ id: 'mezcla', channels: [0, 1] }], 2)
    player.current = p
    setReady(false); setAudioErr(null); setPlaying(false); setTime(0)
    const a = p.audio
    const onReady = () => setReady(true)
    const onEnd = () => setPlaying(false)
    const onErr = () => setAudioErr('No se pudo cargar el audio de esta canción. Prueba a pulsar «Reintentar».')
    a.addEventListener('canplay', onReady); a.addEventListener('ended', onEnd); a.addEventListener('pause', onEnd); a.addEventListener('error', onErr)
    return () => {
      a.removeEventListener('canplay', onReady); a.removeEventListener('ended', onEnd); a.removeEventListener('pause', onEnd); a.removeEventListener('error', onErr)
      p.dispose()
      player.current = null
    }
  }, [job.id, layoutKey])

  // Posición de reproducción. Solo el tutorial (notas que caen) necesita 60 fps; el resto de
  // la pantalla se repinta 12 veces por segundo, que basta para el cursor y ahorra mucha CPU.
  const smooth = tab === 'tutorial'
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      const p = player.current
      if (p && (smooth || now - last > 80)) {
        last = now
        const t = p.time
        setTime((prev) => (Math.abs(prev - t) > 0.005 ? t : prev))
        if (loop && sel !== null && t >= segs[sel].end) p.seek(segs[sel].start)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [loop, sel, job.id, smooth])

  useEffect(() => {
    player.current?.setGains(trackGains(stems.map((s) => s.id), vol, muted, solo))
    player.current?.setRate(rate)
  }, [vol, muted, solo, rate, stems, ready])

  const seek = useCallback((t: number) => { player.current?.seek(t); setTime(t) }, [])
  const pause = useCallback(() => { player.current?.pause(); setPlaying(false) }, [])
  const play = useCallback(() => {
    player.current?.play().then(() => setPlaying(true)).catch((e) => setAudioErr(`No se pudo reproducir: ${(e as Error).message}`))
  }, [])
  const toggle = () => (playing ? pause() : play())

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
          {analysis.method && <span className="pill" title="Método de detección de acordes">{analysis.method}</span>}
          {job.source?.kind === 'youtube' && job.source.url && (
            <a className="pill" href={job.source.url} target="_blank" rel="noreferrer" title="Abrir el vídeo original">▶ YouTube{job.source.uploader ? ` · ${job.source.uploader}` : ''}</a>
          )}
          {(job.instruments ?? []).slice(0, 5).map((i) => <span key={i.name} className="pill violet" title="Instrumento detectado">{i.icon} {i.name}</span>)}
          <div className="spacer" />
          <button className="btn sm" onClick={saveToLibrary}>Guardar progresión</button>
          <button className="btn sm ghost" onClick={() => confirm('¿Borrar esta canción y sus pistas?') && onDelete()}><IconTrash /></button>
        </div>
        <div className="row mt">
          <button className="btn primary" onClick={toggle} disabled={!ready}>
            {!ready ? 'Cargando audio…' : playing ? <><IconStop /> Pausa</> : <><IconPlay /> Reproducir</>}</button>
          <span className="mono small text-2">{fmt(time)} / {fmt(dur)}</span>
          <input type="range" className="range" style={{ flex: 1 }} min={0} max={dur} step={0.1} value={time} onChange={(e) => seek(+e.target.value)} />
          <label className="small text-2 row" style={{ gap: 6 }}>Velocidad {Math.round(rate * 100)}%
            <input type="range" min={0.4} max={1} step={0.05} value={rate} onChange={(e) => setRate(+e.target.value)} />
          </label>
          <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} disabled={sel === null} /> Repetir acorde
          </label>
        </div>
        {(() => {
          // Acorde que suena y los dos siguientes, siempre a la vista junto al transporte.
          const cur = curIdx >= 0 ? segs[curIdx] : null
          const upcoming = segs.slice(Math.max(0, curIdx + 1)).filter((sg, k, arr) => sg.symbol !== 'N' && (k === 0 ? sg.symbol !== cur?.symbol : sg.symbol !== arr[k - 1].symbol)).slice(0, 2)
          const pct = cur ? Math.min(100, ((time - cur.start) / Math.max(0.1, cur.end - cur.start)) * 100) : 0
          return (
            <div className="now-next mt" aria-label="Acorde actual y siguientes">
              <div className="nn-now">
                <span className="small muted">Ahora</span>
                <b style={{ color: cur && cur.symbol !== 'N' ? fnColor(cur.function) : undefined }}>{cur && cur.symbol !== 'N' ? cur.symbol : '—'}</b>
                {cur?.roman && <small>{cur.roman}</small>}
                <div className="nn-bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
              {upcoming.map((sg, k) => (
                <div key={sg.start} className="nn-next" onClick={() => seek(sg.start)} title="Saltar a este acorde">
                  <span className="small muted">{k === 0 ? `Siguiente · en ${Math.max(0, sg.start - time).toFixed(1)} s` : 'Después'}</span>
                  <b>{sg.symbol}</b>
                  {sg.roman && <small>{sg.roman}</small>}
                </div>
              ))}
            </div>
          )
        })()}
        {audioErr && (
          <div className="error mt row">{audioErr}<div className="spacer" />
            <button className="btn sm" onClick={() => api.post<Job>(`/api/stems/${job.id}/retry`, {}).then(onChange)}>Reintentar</button></div>
        )}
        {job.warning && <div className="notice mt">{job.warning}</div>}
        <div className="mt">
          <ChordChart segments={segs} beats={analysis.beats ?? []} duration={dur} time={time} selected={sel}
                      onPick={(i, at) => { setSel(i); seek(at) }} onSeek={seek} />
        </div>
      </div>

      <div className="seg" data-tour="stems-tabs">
        <button className={tab === 'acordes' ? 'on' : ''} onClick={() => setTab('acordes')}>1 · Acordes y pistas</button>
        <button className={tab === 'letra' ? 'on' : ''} onClick={() => setTab('letra')}>2 · Letra y acordes</button>
        <button className={tab === 'tutorial' ? 'on' : ''} onClick={() => setTab('tutorial')}>3 · Tutorial de {isGuitar ? 'guitarra' : 'piano'} {job.validated ? '✓' : ''}</button>
      </div>

      {tab === 'letra' && <LyricsSheet job={job} time={time} onSeek={seek} onJob={(j) => onChange(j)} />}
      {tab === 'tutorial' && (
        (() => {
          // Al silenciar «el instrumento original» se apaga su pista; sin separar, la mezcla entera.
          // Si Demucs sacó una pista propia del instrumento, solo esa; si no, va dentro de «otros».
          const mine = isGuitar ? 'guitar' : 'piano'
          const own = stems.some((st) => st.id === mine) ? [mine] : ['other', 'mezcla']
          const props = {
            jobId: job.id, validated: !!job.validated, lines: job.lyrics?.lines ?? [], time, playing, onPlay: play, onPause: pause, onSeek: seek,
            onMuteOriginal: (m: boolean) => setMuted((cur) => ({ ...cur, ...Object.fromEntries(stems.filter((st) => own.includes(st.id) && (job.separated ? st.id !== 'mezcla' : true)).map((st) => [st.id, m])) })),
          }
          return isGuitar ? <GuitarSongTutorial {...props} /> : <SongTutorial {...props} />
        })()
      )}

      {tab === 'acordes' && <div className="grid grid-2">
        <Mixer stems={job.stems.filter((st) => (job.separated ? st.id !== 'mezcla' : st.id === 'mezcla'))} separated={job.separated}
               duration={dur} time={time} muted={muted} solo={solo} vol={vol}
               method={job.instruments_method} status={job.instruments_status} statusError={job.instruments_error}
               level={playing ? (id) => player.current?.level(id) ?? 0 : undefined}
               onMute={(id) => setMuted((m) => ({ ...m, [id]: !m[id] }))} onSolo={(id) => setSolo((x) => (x === id ? null : id))}
               onVol={(id, v) => setVol((x) => ({ ...x, [id]: v }))}
               onRedetect={() => api.post<Job>(`/api/stems/${job.id}/instruments`, {}).then(onChange)} />

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
              <Keys from={48} to={83} marks={marks} height={95} />
              {sel !== null && (
                <div className="stack" style={{ gap: 8 }}>
                  {shownSeg.alternatives && shownSeg.alternatives.length > 0 && (
                    <div className="row" style={{ gap: 6 }}>
                      <span className="small text-2">También podría ser:</span>
                      {shownSeg.alternatives.map((a) => <button key={a} className="btn sm" onClick={() => correct({ symbol: a })}>{a}</button>)}
                    </div>
                  )}
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
      </div>}
    </div>
  )
}
