import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from './Toast'
import ChordTutor from './ChordTutor'

interface SheetWord { text: string; start: number; end: number; chord: { symbol: string; segment: number } | null }
type Row =
  | { type: 'verse'; start: number; end: number; words: SheetWord[] }
  | { type: 'instrumental'; start: number; end: number; chords: { symbol: string; time: number; segment: number }[] }

export interface LyricsJob {
  id: string
  lyrics_status?: string
  lyrics_error?: string
  lyrics?: { source: string; lines: unknown[]; text?: string }
  validated?: boolean
  analysis: { segments: { symbol: string; alternatives?: string[] }[] } | null
}

/**
 * Hoja de cancionero: la letra con cada acorde encima de la palabra en la que
 * cambia. Sigue la reproducción (karaoke), permite corregir acordes y versos y
 * marcar la canción como validada.
 */
export default function LyricsSheet({ job, time, onSeek, onJob }: {
  job: LyricsJob; time: number; onSeek: (t: number) => void; onJob: (j: never) => void
}) {
  const [sheet, setSheet] = useState<Row[]>([])
  const [caps, setCaps] = useState<{ whisper: boolean; model: string } | null>(null)
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState(job.lyrics?.text ?? '')
  const [editing, setEditing] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [tutor, setTutor] = useState<string | null>(null)
  const [size, setSize] = useState(18)
  const toast = useToast()

  const refresh = () => api.get<Row[]>(`/api/stems/${job.id}/sheet`).then(setSheet)
  useEffect(() => { refresh() }, [job])
  useEffect(() => { api.get<{ whisper: boolean; model: string }>('/api/stems/lyrics/capabilities').then(setCaps).catch(() => {}) }, [])
  // Mientras Whisper trabaja se consulta el estado cada 2 s.
  useEffect(() => {
    if (job.lyrics_status !== 'transcribiendo') return
    const t = setInterval(() => api.get(`/api/stems/${job.id}`).then((j) => onJob(j as never)), 2000)
    return () => clearInterval(t)
  }, [job.lyrics_status])

  const transcribe = () => api.post(`/api/stems/${job.id}/lyrics/transcribe`, {}).then((j) => onJob(j as never)).catch((e) => toast(e.message, 'error'))
  const saveText = () => api.put(`/api/stems/${job.id}/lyrics`, { text }).then((j) => { onJob(j as never); setPasting(false); toast('Letra colocada') })
  const fixChord = (segment: number, symbol: string) =>
    api.put(`/api/stems/${job.id}/segments/${segment}`, { symbol }).then((j) => { onJob(j as never); setEditing(null); setCustom('') })
      .catch((e) => toast(e.message, 'error'))
  const shift = (line: number, seconds: number) => api.post(`/api/stems/${job.id}/lyrics/lines/${line}/shift`, { seconds }).then((j) => onJob(j as never))
  const validate = (v: boolean) => api.put(`/api/stems/${job.id}/validated`, { validated: v }).then((j) => { onJob(j as never); if (v) toast('Canción validada: ya puedes abrir el tutorial') })

  const hasLyrics = !!job.lyrics?.lines?.length
  let verseIndex = -1
  const editingSeg = editing !== null ? job.analysis?.segments[editing] : null

  return (
    <div className="card stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>Letra y acordes</h2>
        {job.lyrics && <span className="pill">{job.lyrics.source}</span>}
        {job.validated && <span className="pill teal">✓ validada</span>}
        <div className="spacer" />
        <button className="btn sm ghost" onClick={() => setSize((s) => Math.max(14, s - 2))}>A−</button>
        <button className="btn sm ghost" onClick={() => setSize((s) => Math.min(30, s + 2))}>A+</button>
        {caps?.whisper && (
          <button className="btn sm" onClick={transcribe} disabled={job.lyrics_status === 'transcribiendo'}>
            {job.lyrics_status === 'transcribiendo' ? 'Transcribiendo…' : '🎤 Transcribir la voz'}
          </button>
        )}
        <button className="btn sm" onClick={() => setPasting((p) => !p)}>📋 {hasLyrics ? 'Editar letra' : 'Pegar letra'}</button>
        {hasLyrics && (job.validated
          ? <button className="btn sm ghost" onClick={() => validate(false)}>Quitar validación</button>
          : <button className="btn sm primary" onClick={() => validate(true)}>✓ Está bien</button>)}
      </div>
      {job.lyrics_status === 'error' && <div className="error">La transcripción falló: {job.lyrics_error}</div>}
      {!caps?.whisper && <div className="small muted">Whisper no está instalado: puedes pegar la letra y la coloco según las frases de la voz.</div>}
      {pasting && (
        <div className="stack fade-in">
          <textarea className="input" rows={8} style={{ width: '100%', fontSize: 15 }} value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="Pega aquí la letra, un verso por línea. Si antes has transcrito la voz, la alineo palabra a palabra con ella." />
          <div className="row"><button className="btn primary sm" onClick={saveText} disabled={!text.trim()}>Colocar letra</button>
            <button className="btn ghost sm" onClick={() => setPasting(false)}>Cancelar</button></div>
        </div>
      )}

      <div className="sheet" style={{ fontSize: size }}>
        {sheet.length === 0 && <div className="empty-state">Sin letra todavía. Transcribe la voz o pega la letra; mientras, los acordes salen como líneas instrumentales.</div>}
        {sheet.map((row, r) => {
          const active = time >= row.start && time < row.end + 0.3
          if (row.type === 'instrumental') {
            return (
              <div key={r} className={`sheet-row instrumental ${active ? 'on' : ''}`}>
                <span className="small muted">♪</span>
                {row.chords.map((c, k) => (
                  <button key={k} className="sheet-chord" onClick={() => { onSeek(c.time); setEditing(c.segment) }}>{c.symbol}</button>
                ))}
              </div>
            )
          }
          verseIndex++
          const vi = verseIndex
          return (
            <div key={r} className={`sheet-row ${active ? 'on' : ''}`}>
              <div className="sheet-words">
                {row.words.map((w, k) => (
                  <span key={k} className={`sheet-word ${time >= w.start && time < w.end + 0.15 ? 'now' : ''}`} onClick={() => onSeek(w.start)}>
                    <span className="sheet-chord-slot">
                      {w.chord && <button className="sheet-chord" onClick={(e) => { e.stopPropagation(); setEditing(w.chord!.segment) }}>{w.chord.symbol}</button>}
                    </span>
                    {w.text}
                  </span>
                ))}
              </div>
              <span className="sheet-nudge">
                <button className="btn sm ghost" title="Adelantar el verso" onClick={() => shift(vi, -0.25)}>−¼ s</button>
                <button className="btn sm ghost" title="Retrasar el verso" onClick={() => shift(vi, 0.25)}>+¼ s</button>
              </span>
            </div>
          )
        })}
      </div>

      {editingSeg && editing !== null && (
        <div className="chord-editor fade-in">
          <b>Acorde: {editingSeg.symbol}</b>
          {(editingSeg.alternatives ?? []).map((a) => <button key={a} className="btn sm" onClick={() => fixChord(editing, a)}>{a}</button>)}
          <input className="input chord-input" placeholder="otro…" value={custom} onChange={(e) => setCustom(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && custom.trim() && fixChord(editing, custom.trim())} />
          <button className="btn sm" onClick={() => setTutor(editingSeg.symbol.split(' ')[0])}>🎹 Cómo se toca</button>
          <button className="btn sm ghost" onClick={() => setEditing(null)}>Cerrar</button>
        </div>
      )}
      {tutor && <ChordTutor symbol={tutor} onClose={() => setTutor(null)} />}
    </div>
  )
}
