import { useEffect, useRef, useState } from 'react'
import ChordDiagram from './ChordDiagram'
import Fretboard, { type FretDot } from './Fretboard'
import { IconPlay, IconStop } from './Icons'
import { api } from '../lib/api'
import type { Shape } from '../lib/guitar'
import { useInput } from '../lib/input'
import { usePersistentState } from '../lib/prefs'

interface Item { index: number; start: number; end: number; symbol: string; shape: Shape | null }
interface Suggestion { capo: number; ease: number; barre_chords: number; shapes: string[] }
interface Arrangement { capo: number; suggestions: Suggestion[]; items: Item[] }
interface Line { start: number; end: number; words: { text: string; start: number; end: number }[] }

const WINDOW = 8 // segundos visibles en la pista de acordes
const PAST = 1.5 // segundos ya pasados que siguen a la vista (a la izquierda del cursor)

/**
 * Tutorial de guitarra de una canción: una pista de acordes que avanza hacia el
 * cursor (como en los juegos de ritmo, pero con diagramas), el acorde actual y el
 * siguiente con su posición, el mástil con los dedos y la letra en karaoke. Las
 * posiciones se eligen para mover la mano lo menos posible, con la cejilla que
 * deja formas más fáciles.
 */
export default function GuitarSongTutorial({ jobId, validated, lines, time, playing, onPlay, onPause, onSeek, onMuteOriginal }: {
  jobId: string; validated: boolean; lines: Line[]; time: number; playing: boolean
  onPlay: () => void; onPause: () => void; onSeek: (t: number) => void; onMuteOriginal: (mute: boolean) => void
}) {
  // null = la cejilla que recomienda el servidor; un número = la que eliges tú.
  const [capo, setCapo] = useState<number | null>(null)
  const [data, setData] = useState<Arrangement | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [wait, setWait] = usePersistentState('gsong.wait', false)
  const [waiting, setWaiting] = useState<number | null>(null)
  const [mute, setMute] = useState(false)
  const { pressed, press, release } = useInput()
  const lastIdx = useRef(-1)

  useEffect(() => {
    setErr(null)
    api.get<Arrangement>(`/api/stems/${jobId}/guitar-arrangement${capo === null ? '' : `?capo=${capo}`}`).then(setData).catch((e) => setErr(e.message))
  }, [jobId, capo])
  useEffect(() => () => onMuteOriginal(false), [])

  const items = data?.items ?? []
  const idx = items.findIndex((a) => time >= a.start && time < a.end)
  const cur = idx >= 0 ? items[idx] : null
  const next = items.slice(Math.max(0, idx + 1)).find((a) => a.shape && a.symbol !== cur?.symbol)

  // Modo espera: igual que en piano, se para en cada acorde nuevo hasta que suenan sus notas.
  useEffect(() => {
    if (!wait || idx < 0 || !playing || idx === lastIdx.current) return
    lastIdx.current = idx
    if (cur?.shape && cur.symbol !== items[idx - 1]?.symbol) { onPause(); setWaiting(idx) }
  }, [idx, wait, playing])
  useEffect(() => {
    const target = waiting !== null ? items[waiting]?.shape : null
    if (!target) return
    const need = new Set(target.notes.map((n) => n.midi % 12))
    const have = new Set([...pressed].map((m) => m % 12))
    if ([...need].every((p) => have.has(p))) { setWaiting(null); onPlay() }
  }, [pressed, waiting])

  const shape = cur?.shape ?? null
  const dots: FretDot[] = shape ? shape.notes.map((n) => ({ string: n.string, fret: n.fret, mark: n.fret === 0 ? 'held' : 'lh', label: n.fret > 0 && n.finger ? String(n.finger) : undefined })) : []
  pressed.forEach((m) => {
    const hit = shape?.notes.find((n) => (n.midi - m) % 12 === 0)
    if (hit) dots.push({ string: hit.string, fret: hit.fret, mark: 'pressed', label: hit.finger ? String(hit.finger) : undefined })
  })
  const muted = shape ? shape.frets.map((f, i) => (f < 0 ? 6 - i : 0)).filter(Boolean) : []
  const usedCapo = data?.capo ?? 0

  // Pista: cada cambio de acorde es una tarjeta; los acordes repetidos seguidos se funden.
  const lane: Item[] = []
  items.forEach((a) => {
    const prev = lane[lane.length - 1]
    if (prev && prev.symbol === a.symbol) lane[lane.length - 1] = { ...prev, end: a.end }
    else lane.push(a)
  })
  const xOf = (t: number) => ((t - time + PAST) / WINDOW) * 100
  const line = lines.find((l) => time >= l.start - 0.2 && time < l.end + 0.5)
  const nextLine = lines.find((l) => l.start >= (line?.end ?? time) && l !== line)

  return (
    <div className="card stack song-tutorial">
      <div className="row">
        <h2 style={{ margin: 0 }}>Tutorial de guitarra</h2>
        {!validated && <span className="pill coral" title="Revisa acordes y letra en las otras pestañas">sin validar: puede haber acordes erróneos</span>}
        <div className="spacer" />
        <label className="small text-2 row" style={{ gap: 6 }}>Cejilla
          <select className="select" value={capo ?? 'auto'} aria-label="Cejilla"
                  onChange={(e) => setCapo(e.target.value === 'auto' ? null : +e.target.value)}>
            <option value="auto">recomendada{data && capo === null ? ` (${data.capo || 'sin'})` : ''}</option>
            {Array.from({ length: 8 }, (_, c) => <option key={c} value={c}>{c ? `traste ${c}` : 'sin cejilla'}</option>)}
          </select>
        </label>
        <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={wait} onChange={(e) => { setWait(e.target.checked); setWaiting(null); lastIdx.current = -1 }} /> Modo espera
        </label>
        <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={mute} onChange={(e) => { setMute(e.target.checked); onMuteOriginal(e.target.checked) }} /> Silenciar guitarra original
        </label>
        <button className="btn primary" onClick={() => (playing ? onPause() : onPlay())}>{playing ? <><IconStop /> Pausa</> : <><IconPlay /> Reproducir</>}</button>
      </div>
      {err && <div className="error">{err}</div>}

      {data && data.suggestions.length > 0 && (
        <div className="row small" style={{ gap: 8 }}>
          <span className="muted">Cejillas fáciles:</span>
          {data.suggestions.map((s) => (
            <button key={s.capo} className={`btn sm ${s.capo === usedCapo ? 'primary' : 'ghost'}`} onClick={() => setCapo(s.capo)}
                    title={`${s.barre_chords} acordes con cejilla de dedo`}>
              {s.capo ? `Traste ${s.capo}` : 'Sin cejilla'} · {[...new Set(s.shapes)].slice(0, 5).join(' ')}
            </button>
          ))}
        </div>
      )}

      <div className="chord-lane" aria-label="Pista de acordes">
        <div className="chord-lane-now" style={{ left: `${(PAST / WINDOW) * 100}%` }} />
        {lane.filter((a) => a.end > time - PAST && a.start < time + WINDOW).map((a) => (
          <button key={a.index} className={`lane-chip ${time >= a.start && time < a.end ? 'on' : ''}`}
                  style={{ left: `${Math.max(0, xOf(a.start))}%`, width: `${Math.max(2, xOf(a.end) - Math.max(0, xOf(a.start)))}%` }}
                  onClick={() => onSeek(a.start)} title={a.shape?.shape_of && a.shape.shape_of !== a.symbol ? `forma de ${a.shape.shape_of}` : a.symbol}>
            <b>{a.symbol === 'N' ? '·' : a.symbol}</b>
            {a.shape && a.shape.shape_of && a.shape.shape_of !== a.symbol.split(' ')[0] && <span className="small">({a.shape.shape_of})</span>}
          </button>
        ))}
      </div>

      <div className="guitar-now">
        <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
          <div className="small muted">Ahora</div>
          {shape && usedCapo > 0 && <div className="small text-2">suena {cur?.symbol}</div>}
          {shape ? <ChordDiagram shape={shape} size={1.25} active /> : <div className="chord-big" style={{ fontSize: 46 }}>{cur?.symbol === 'N' ? '·' : cur?.symbol ?? '—'}</div>}
          {waiting !== null && <div className="pill coral">Toca {items[waiting].symbol} para seguir</div>}
        </div>
        <div className="stack" style={{ alignItems: 'center', gap: 4, opacity: 0.75 }}>
          <div className="small muted">Siguiente{next ? ` · en ${Math.max(0, next.start - time).toFixed(1)} s` : ''}</div>
          {next?.shape ? <ChordDiagram shape={next.shape} size={0.9} /> : <div style={{ fontSize: 30 }}>—</div>}
        </div>
        <div className="stack" style={{ minWidth: 0, flex: 1 }}>
          <Fretboard dots={dots} muted={muted} capo={usedCapo} frets={12} height={160} onDown={(m) => press(m)} onUp={(m) => release(m)} />
          <div className="karaoke">
            {line ? line.words.map((w, k) => (
              <span key={k} className={time >= w.start ? 'sung' : ''} onClick={() => onSeek(w.start)}>{w.text} </span>
            )) : <span className="muted">♪</span>}
            {nextLine && <div className="karaoke-next">{nextLine.words.map((w) => w.text).join(' ')}</div>}
          </div>
        </div>
      </div>
      {usedCapo > 0 && <div className="small text-2">Cejilla en el traste {usedCapo}: los diagramas muestran la forma que haces; entre paréntesis, si cambia, el nombre de esa forma.</div>}
    </div>
  )
}
