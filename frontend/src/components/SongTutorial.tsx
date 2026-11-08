import { useEffect, useMemo, useRef, useState } from 'react'
import Piano, { pianoGeometry, type Mark } from './Piano'
import { IconPlay, IconStop } from './Icons'
import { api } from '../lib/api'
import { useInput } from '../lib/input'
import { usePersistentState } from '../lib/prefs'
import type { HandNote } from '../lib/tutor'

interface ArrItem { index: number; start: number; end: number; symbol: string; left: HandNote[]; right: HandNote[] }
interface Line { start: number; end: number; words: { text: string; start: number; end: number }[] }

const FROM = 36
const TO = 84
const LOOKAHEAD = 4 // segundos visibles por encima del teclado
const FALL_H = 230

/**
 * Tutorial de piano de una canción, estilo vídeo de YouTube: las notas de cada
 * acorde caen hacia el teclado (turquesa = izquierda, ámbar = derecha, con el
 * número de dedo), el teclado muestra la posición actual de las dos manos, y
 * debajo van el acorde siguiente y la letra en modo karaoke.
 */
export default function SongTutorial({ jobId, validated, lines, time, playing, onPlay, onPause, onSeek, onMuteOriginal }: {
  jobId: string; validated: boolean; lines: Line[]; time: number; playing: boolean
  onPlay: () => void; onPause: () => void; onSeek: (t: number) => void; onMuteOriginal: (mute: boolean) => void
}) {
  const [style, setStyle] = usePersistentState('song.style', 'basico')
  const [arr, setArr] = useState<ArrItem[]>([])
  const [wait, setWait] = usePersistentState('song.wait', false)
  const [waiting, setWaiting] = useState<number | null>(null)
  const [mute, setMute] = useState(false)
  const { pressed } = useInput()
  const geo = useMemo(() => pianoGeometry(FROM, TO), [])
  const lastIdx = useRef(-1)
  // Teclado y zona de caída comparten escala: se mide el ancho disponible para que
  // cada bloque caiga exactamente sobre su tecla.
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1.4)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / geo.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [geo.width])

  useEffect(() => { api.get<ArrItem[]>(`/api/stems/${jobId}/arrangement?style=${style}`).then(setArr) }, [jobId, style])
  useEffect(() => () => onMuteOriginal(false), [])

  const idx = arr.findIndex((a) => time >= a.start && time < a.end)
  const cur = idx >= 0 ? arr[idx] : null
  const next = arr.slice(Math.max(0, idx + 1)).find((a) => a.left.length || a.right.length)

  // Modo espera: al llegar a un acorde nuevo se pausa hasta que lo tocas
  // (basta con sus notas en cualquier octava; las manos, a tu gusto).
  useEffect(() => {
    // Solo se "consume" el acorde cuando se está reproduciendo: así también espera
    // en el primer acorde al pulsar Reproducir.
    if (!wait || idx < 0 || !playing || idx === lastIdx.current) return
    lastIdx.current = idx
    if (cur && (cur.left.length || cur.right.length)) { onPause(); setWaiting(idx) }
  }, [idx, wait, playing])
  useEffect(() => {
    if (waiting === null) return
    const target = arr[waiting]
    const need = new Set([...target.left, ...target.right].map((n) => n.midi % 12))
    const have = new Set([...pressed].map((m) => m % 12))
    if ([...need].every((p) => have.has(p))) { setWaiting(null); onPlay() }
  }, [pressed, waiting])

  const marks: Record<number, Mark> = {}
  const fingers: Record<number, number> = {}
  cur?.left.forEach((n) => { marks[n.midi] = 'lh'; fingers[n.midi] = n.finger })
  cur?.right.forEach((n) => { marks[n.midi] = 'rh'; fingers[n.midi] = n.finger })
  const chordPcs = new Set([...(cur?.left ?? []), ...(cur?.right ?? [])].map((n) => n.midi % 12))
  pressed.forEach((m) => { marks[m] = chordPcs.has(m % 12) ? (m < 60 ? 'lh' : 'rh') : 'wrong' })

  // Bloques que caen: un rectángulo por nota y acorde dentro de la ventana visible.
  const blocks = arr.filter((a) => a.end > time && a.start < time + LOOKAHEAD)
  const yOf = (t: number) => FALL_H - ((t - time) / LOOKAHEAD) * FALL_H
  const line = lines.find((l) => time >= l.start - 0.2 && time < l.end + 0.5)
  const nextLine = lines.find((l) => l.start >= (line?.end ?? time) && l !== line)

  return (
    <div className="card stack song-tutorial">
      <div className="row">
        <h2 style={{ margin: 0 }}>Tutorial de piano</h2>
        {!validated && <span className="pill coral" title="Revisa acordes y letra en las otras pestañas">sin validar: puede haber acordes erróneos</span>}
        <div className="spacer" />
        <div className="seg">{['basico', 'jazz', 'abierto'].map((s) => <button key={s} className={s === style ? 'on' : ''} onClick={() => setStyle(s)}>{s}</button>)}</div>
        <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={wait} onChange={(e) => { setWait(e.target.checked); setWaiting(null); lastIdx.current = -1 }} /> Modo espera
        </label>
        <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={mute} onChange={(e) => { setMute(e.target.checked); onMuteOriginal(e.target.checked) }} /> Silenciar piano original
        </label>
        <button className="btn primary" onClick={() => (playing ? onPause() : onPlay())}>{playing ? <><IconStop /> Pausa</> : <><IconPlay /> Reproducir</>}</button>
      </div>

      <div className="fall-wrap" ref={wrap}>
        <svg viewBox={`0 0 ${geo.width} ${FALL_H}`} width="100%" height={FALL_H * scale} preserveAspectRatio="none" className="fall">
          {[1, 2, 3].map((s) => <line key={s} x1={0} x2={geo.width} y1={yOf(time + s)} y2={yOf(time + s)} stroke="var(--line-soft)" strokeDasharray="3 6" />)}
          {blocks.map((a) => (
            <g key={a.index}>
              <line x1={0} x2={geo.width} y1={yOf(a.start)} y2={yOf(a.start)} stroke="rgba(255,255,255,0.12)" />
              <text x={4} y={yOf(a.start) - 4} fontSize={13} fontWeight={700} fill="var(--text-2)" style={{ fontFamily: 'var(--serif)' }}>{a.symbol}</text>
              {[...a.left.map((n) => ['l', n] as const), ...a.right.map((n) => ['r', n] as const)].map(([h, n]) => {
                const top = Math.max(-4, yOf(a.end) + 1)
                const bottom = Math.min(FALL_H, yOf(a.start) - 1)
                if (bottom <= top) return null
                return (
                  <g key={h + n.midi}>
                    <rect x={geo.keyX(n.midi) + 1.5} y={top} width={geo.keyW(n.midi) - 3} height={bottom - top} rx={4}
                          fill={h === 'l' ? 'var(--teal)' : 'var(--accent)'} opacity={a.index === cur?.index ? 1 : 0.75} />
                    {bottom - top > 16 && (
                      <text x={geo.keyX(n.midi) + geo.keyW(n.midi) / 2} y={bottom - 5} textAnchor="middle" fontSize={11} fontWeight={800} fill="#14161d">{n.finger}</text>
                    )}
                  </g>
                )
              })}
            </g>
          ))}
        </svg>
        <Piano from={FROM} to={TO} marks={marks} fingers={fingers} height={120 * scale} showNames />
      </div>

      <div className="tutorial-info">
        <div>
          <div className="small muted">Ahora</div>
          <div className="chord-big" style={{ fontSize: 46 }}>{cur?.symbol ?? '—'}</div>
          {waiting !== null && <div className="pill coral">Toca {arr[waiting].symbol} para seguir</div>}
        </div>
        <div>
          <div className="small muted">Siguiente{next ? ` · en ${Math.max(0, next.start - time).toFixed(1)} s` : ''}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, color: 'var(--text-2)' }}>{next?.symbol ?? '—'}</div>
          {next && cur && <div className="next-bar"><span style={{ width: `${Math.min(100, ((time - cur.start) / Math.max(0.1, cur.end - cur.start)) * 100)}%` }} /></div>}
        </div>
        <div className="karaoke">
          {line ? line.words.map((w, k) => (
            <span key={k} className={time >= w.start ? 'sung' : ''} onClick={() => onSeek(w.start)}>{w.text} </span>
          )) : <span className="muted">♪</span>}
          {nextLine && <div className="karaoke-next">{nextLine.words.map((w) => w.text).join(' ')}</div>}
        </div>
      </div>
    </div>
  )
}
