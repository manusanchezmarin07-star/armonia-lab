import { useEffect, useMemo, useRef, useState } from 'react'
import Piano, { type Mark } from './Piano'
import Staff from './Staff'
import { IconPlay, IconStop } from './Icons'
import { api } from '../lib/api'
import { Tone, ensureAudio, playChord } from '../lib/audio'
import { useInput } from '../lib/input'
import { downloadMidi, notesToMidi } from '../lib/midifile'
import { usePersistentState } from '../lib/prefs'
import { useRecorder } from '../lib/recorder'
import { PATTERNS, evaluateTake, patternSteps, type HandsData, type TakeReport } from '../lib/tutor'

const FINGER_NAMES = ['', 'pulgar', 'índice', 'corazón', 'anular', 'meñique']
type Tab = 'pasos' | 'arpegios' | 'practica'

/**
 * Tutor para tocar un acorde: qué notas va en cada mano, con qué dedos, cómo
 * arpegiarlo y un modo de práctica que espera a que lo toques y graba tu toma.
 */
export default function ChordTutor({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [style, setStyle] = usePersistentState('tutor.style', 'basico')
  const [inversion, setInversion] = useState(0)
  const [data, setData] = useState<HandsData | null>(null)
  const [styles, setStyles] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pasos')
  const [step, setStep] = useState(0)
  const [pattern, setPattern] = usePersistentState('tutor.pattern', 'subir')
  const [bpm, setBpm] = usePersistentState('tutor.bpm', 90)
  const [beat, setBeat] = useState<number | null>(null)
  const [stepDone, setStepDone] = useState<boolean[]>([false, false, false])
  const [report, setReport] = useState<TakeReport | null>(null)
  const timers = useRef<number[]>([])
  const { pressed } = useInput()
  const rec = useRecorder()

  useEffect(() => { api.get<{ styles: Record<string, string> }>('/api/chords/hand-styles').then((r) => setStyles(r.styles)) }, [])
  useEffect(() => {
    setErr(null)
    api.get<HandsData>(`/api/chords/hands?symbol=${encodeURIComponent(symbol)}&style=${style}&inversion=${inversion}`)
      .then((d) => { setData(d); setStepDone([false, false, false]); setReport(null) })
      .catch((e) => setErr(e.message))
  }, [symbol, style, inversion])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', esc); timers.current.forEach(clearTimeout) }
  }, [onClose])

  const lh = data?.left.map((n) => n.midi) ?? []
  const rh = data?.right.map((n) => n.midi) ?? []
  const steps = useMemo(() => patternSteps(lh, rh, pattern), [lh.join(), rh.join(), pattern])
  const spell = useMemo(() => {
    const s: Record<number, string> = {}
    Object.entries(data?.spell ?? {}).forEach(([pc, n]) => (s[+pc] = n))
    return s
  }, [data])

  // Modo espera (pestaña Paso a paso): cuando lo pulsado coincide con el paso, se marca y se avanza.
  const stepNotes = data ? data.steps[step]?.notes ?? [] : []
  useEffect(() => {
    if (tab !== 'pasos' || !stepNotes.length) return
    if (stepNotes.every((n) => pressed.has(n)) && pressed.size === stepNotes.length) {
      setStepDone((d) => d.map((x, i) => (i === step ? true : x)))
      const t = window.setTimeout(() => setStep((s) => Math.min(2, s + 1)), 600)
      timers.current.push(t)
    }
  }, [pressed])

  const stopPlayback = () => { timers.current.forEach(clearTimeout); timers.current = []; setBeat(null) }
  const playPattern = async (loop = false) => {
    stopPlayback()
    const inst = await ensureAudio()
    const dt = 60 / bpm / (pattern === 'bloque' ? 1 : 2) // corcheas
    const t0 = Tone.now() + 0.05
    steps.forEach((s, i) => {
      s.forEach((n) => inst.triggerAttackRelease(Tone.Frequency(n, 'midi').toFrequency(), pattern === 'bloque' ? 1.6 : dt * 1.8, t0 + i * dt, 0.65))
      timers.current.push(window.setTimeout(() => setBeat(i), (i * dt + 0.05) * 1000))
    })
    timers.current.push(window.setTimeout(() => (loop ? playPattern(true) : setBeat(null)), steps.length * dt * 1000 + 300))
  }

  const finishRecording = () => {
    rec.stop()
  }
  useEffect(() => { if (!rec.recording && rec.take.length) setReport(evaluateTake(rec.take, steps, pattern)) }, [rec.take])

  // Colores del teclado según la pestaña.
  const marks: Record<number, Mark> = {}
  const fingers: Record<number, number> = {}
  if (data) {
    const showHand = (hand: 'left' | 'right', solid: boolean) => {
      const list = hand === 'left' ? data.left : data.right
      list.forEach((n) => {
        marks[n.midi] = solid ? (hand === 'left' ? 'lh' : 'rh') : (hand === 'left' ? 'lh-todo' : 'rh-todo')
        fingers[n.midi] = n.finger
      })
    }
    if (tab === 'pasos') {
      const h = data.steps[step].hand
      if (h !== 'right') showHand('left', true)
      if (h !== 'left') showHand('right', true)
    } else if (tab === 'arpegios') {
      showHand('left', false); showHand('right', false)
      if (beat !== null) steps[beat]?.forEach((n) => (marks[n] = lh.includes(n) ? 'lh' : 'rh'))
    } else {
      showHand('left', false); showHand('right', false)
    }
    // Lo que pulsas: en verde de mano si es correcto, en coral si sobra.
    pressed.forEach((n) => { marks[n] = data.notes.includes(n) ? (lh.includes(n) ? 'lh' : 'rh') : 'wrong' })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal tutor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Cómo tocar ${symbol}`}>
        <div className="row">
          <div>
            <div className="eyebrow">Cómo se toca</div>
            <div className="chord-big" style={{ fontSize: 44 }}>{data?.symbol ?? symbol}</div>
          </div>
          <div className="spacer" />
          <div className="seg">{Object.keys(styles).map((s) => (
            <button key={s} className={s === style ? 'on' : ''} onClick={() => { setStyle(s); setInversion(0) }}>{s}</button>))}</div>
          {style !== 'jazz' && (
            <div className="seg">{['Fund.', '1ª inv.', '2ª inv.', '3ª inv.'].slice(0, Math.min(4, (data?.right.length ?? 3))).map((l, i) => (
              <button key={l} className={i === inversion ? 'on' : ''} onClick={() => setInversion(i)}>{l}</button>))}</div>
          )}
          <button className="btn ghost sm" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {styles[style] && <p className="small text-2" style={{ margin: '6px 0 0' }}>{styles[style]}</p>}
        {err && <div className="error mt">{err}</div>}

        {data && (
          <>
            <div className="seg mt">
              <button className={tab === 'pasos' ? 'on' : ''} onClick={() => setTab('pasos')}>1 · Paso a paso</button>
              <button className={tab === 'arpegios' ? 'on' : ''} onClick={() => setTab('arpegios')}>2 · Arpegios</button>
              <button className={tab === 'practica' ? 'on' : ''} onClick={() => setTab('practica')}>3 · Practicar y grabar</button>
            </div>

            <div className="tutor-body">
              <div className="stack" style={{ minWidth: 0 }}>
                <Piano from={36} to={84} marks={marks} fingers={fingers} height={150} showNames />
                <div className="row small text-2" style={{ gap: 14 }}>
                  <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--teal)' }} /> mano izquierda</span>
                  <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--accent)' }} /> mano derecha</span>
                  <span>número = dedo: 1 pulgar · 2 índice · 3 corazón · 4 anular · 5 meñique</span>
                </div>

                {tab === 'pasos' && (
                  <div className="tutor-steps">
                    {data.steps.map((s, i) => (
                      <div key={i} className={`tutor-step ${i === step ? 'on' : ''} ${stepDone[i] ? 'done' : ''}`} onClick={() => { setStep(i); playChord(s.notes, 1.4) }}>
                        <div className="row"><b>{stepDone[i] ? '✓ ' : `${i + 1}. `}{s.title}</b><div className="spacer" />
                          <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); playChord(s.notes, 1.4) }}><IconPlay /></button></div>
                        <div className="small text-2">{s.text}</div>
                      </div>
                    ))}
                    <div className="small muted">Modo espera: toca en tu teclado las notas del paso marcado; cuando estén todas, pasa solo al siguiente.</div>
                  </div>
                )}

                {tab === 'arpegios' && (
                  <div className="stack">
                    <div className="row">
                      <select className="select" value={pattern} onChange={(e) => setPattern(e.target.value)}>
                        {Object.entries(PATTERNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <label className="small text-2 row" style={{ gap: 8 }}>♩ = {bpm}
                        <input type="range" min={40} max={180} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
                      </label>
                      <button className="btn primary" onClick={() => playPattern(false)}><IconPlay /> Escuchar</button>
                      <button className="btn" onClick={() => playPattern(true)}>En bucle</button>
                      {beat !== null && <button className="btn ghost" onClick={stopPlayback}><IconStop /> Parar</button>}
                    </div>
                    <div className="arp-strip">
                      {steps.map((s, i) => (
                        <span key={i} className={`arp-cell ${beat === i ? 'on' : ''}`}>
                          {s.map((n) => {
                            const f = data.left.find((x) => x.midi === n) ?? data.right.find((x) => x.midi === n)
                            return <span key={n} className={lh.includes(n) ? 'l' : 'r'}>{f ? `${f.finger}` : '·'}</span>
                          })}
                        </span>
                      ))}
                    </div>
                    <div className="small muted">Cada casilla es un golpe; el número es el dedo. Turquesa = izquierda, ámbar = derecha.</div>
                  </div>
                )}

                {tab === 'practica' && (
                  <div className="stack">
                    <div className="row">
                      <select className="select" value={pattern} onChange={(e) => setPattern(e.target.value)} disabled={rec.recording}>
                        {Object.entries(PATTERNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      {!rec.recording
                        ? <button className="btn primary" onClick={() => { setReport(null); rec.start() }}>● Grabar</button>
                        : <button className="btn primary rec-on" onClick={finishRecording}>■ Terminar toma</button>}
                      <button className="btn" onClick={() => playPattern(false)}><IconPlay /> Modelo</button>
                      <button className="btn" disabled={!rec.take.length} onClick={() => rec.play()}><IconPlay /> Tu toma</button>
                      <button className="btn sm ghost" disabled={!rec.take.length}
                              onClick={() => downloadMidi(`toma ${data.symbol}`, notesToMidi(rec.take))}>Exportar toma .mid</button>
                    </div>
                    {rec.recording && <div className="small" style={{ color: 'var(--coral)' }}>Grabando… toca el acorde ({PATTERNS[pattern].toLowerCase()}) y pulsa «Terminar toma».</div>}
                    {report && (
                      <div className="report fade-in">
                        <div className="score-ring" style={{ ['--p' as string]: report.score }}><span>{report.score}</span></div>
                        <div className="stack" style={{ gap: 4 }}>
                          {report.messages.map((m, i) => <div key={i} className="small">{m}</div>)}
                        </div>
                      </div>
                    )}
                    {rec.take.length > 0 && <TakeRoll take={rec.take} target={data.notes} />}
                  </div>
                )}
              </div>

              <div className="stack" style={{ alignItems: 'center' }}>
                <div className="read-paper"><Staff notes={data.notes} spell={spell} width={230} /></div>
                <div className="finger-table">
                  {[...data.left, ...data.right].map((n) => (
                    <div key={n.midi} className="row" style={{ gap: 8 }}>
                      <span className="finger-badge" style={{ background: lh.includes(n.midi) ? 'var(--teal)' : 'var(--accent)' }}>{n.finger}</span>
                      <span style={{ minWidth: 44 }}><b>{n.note}</b></span>
                      <span className="small text-2">{n.role} · {FINGER_NAMES[n.finger]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Mini piano roll: tu toma (barras) sobre las notas objetivo (filas resaltadas). */
function TakeRoll({ take, target }: { take: { note: number; start: number; end: number }[]; target: number[] }) {
  const notes = [...new Set([...take.map((t) => t.note), ...target])].sort((a, b) => b - a)
  const dur = Math.max(1000, ...take.map((t) => t.end))
  const rowH = 12
  const W = 600
  return (
    <svg viewBox={`0 0 ${W} ${notes.length * rowH}`} width="100%" height={notes.length * rowH} className="take-roll">
      {notes.map((n, i) => (
        <rect key={n} x={0} y={i * rowH} width={W} height={rowH - 1} fill={target.includes(n) ? 'rgba(232,176,75,0.08)' : 'transparent'} />
      ))}
      {take.map((t, k) => {
        const i = notes.indexOf(t.note)
        return <rect key={k} x={(t.start / dur) * W} y={i * rowH + 1} width={Math.max(3, ((t.end - t.start) / dur) * W)} height={rowH - 3} rx={2}
                     fill={target.includes(t.note) ? 'var(--teal)' : 'var(--coral)'} />
      })}
    </svg>
  )
}
