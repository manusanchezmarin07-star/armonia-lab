import { useEffect, useMemo, useRef, useState } from 'react'
import ChordDiagram from './ChordDiagram'
import Fretboard, { type FretDot } from './Fretboard'
import { IconPlay, IconStop } from './Icons'
import { api } from '../lib/api'
import { Tone, ensureAudio, strum } from '../lib/audio'
import type { Shape } from '../lib/guitar'
import { GUITAR_PATTERNS, guitarSteps, guitarStrokes, snapToTargets } from '../lib/guitarPatterns'
import { useInput } from '../lib/input'
import { downloadMidi, notesToMidi } from '../lib/midifile'
import { usePersistentState } from '../lib/prefs'
import { useRecorder } from '../lib/recorder'
import { evaluateTake, type TakeReport } from '../lib/tutor'

type Tab = 'pasos' | 'mano' | 'practica'

/**
 * Tutor de acordes en guitarra: posiciones con digitación (diagrama y mástil),
 * cómo montarlas dedo a dedo, rasgueos y arpegios de mano derecha, y un modo de
 * práctica que graba tu toma (desde el mástil en pantalla o un teclado MIDI).
 */
export default function GuitarTutor({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [capo, setCapo] = usePersistentState('gtutor.capo', 0)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [sel, setSel] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pasos')
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<boolean[]>([])
  const [pattern, setPattern] = usePersistentState('gtutor.pattern', 'pima')
  const [bpm, setBpm] = usePersistentState('gtutor.bpm', 80)
  const [beat, setBeat] = useState<number | null>(null)
  const [report, setReport] = useState<TakeReport | null>(null)
  const timers = useRef<number[]>([])
  const { pressed, press, release } = useInput()
  const rec = useRecorder()

  useEffect(() => {
    setErr(null)
    api.get<Shape[]>(`/api/guitar/chord?symbol=${encodeURIComponent(symbol)}&capo=${capo}&limit=8`)
      .then((s) => { setShapes(s); setSel(0) })
      .catch((e) => { setShapes([]); setErr(e.message) })
  }, [symbol, capo])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', esc); timers.current.forEach(clearTimeout) }
  }, [onClose])

  const shape = shapes[sel]
  const steps = useMemo(() => (shape ? guitarSteps(shape) : []), [shape])
  const strokes = useMemo(() => (shape ? guitarStrokes(shape, pattern) : []), [shape, pattern])
  const target = shape?.notes.map((n) => n.midi) ?? []
  useEffect(() => { setStep(0); setDone(steps.map(() => false)); setReport(null) }, [steps])

  // Modo espera: lo pulsado (mástil o MIDI, en cualquier octava) debe contener las notas del paso.
  useEffect(() => {
    const need = steps[step]?.notes ?? []
    if (tab !== 'pasos' || !need.length) return
    const pcs = new Set([...pressed].map((n) => n % 12))
    if (need.every((n) => pcs.has(n % 12))) {
      setDone((d) => d.map((x, i) => (i === step ? true : x)))
      timers.current.push(window.setTimeout(() => setStep((s) => Math.min(steps.length - 1, s + 1)), 600))
    }
  }, [pressed])

  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; setBeat(null) }
  const playPattern = async (loop = false) => {
    stop()
    const inst = await ensureAudio()
    const dt = 60 / bpm / 2 // corcheas
    const t0 = Tone.now() + 0.05
    strokes.forEach((s, i) => {
      const t = t0 + i * dt
      if (s.strum) strum(s.notes, s.strum, 14, dt * 2.2, s.strum === 'up' ? 0.55 : 0.72, t)
      else s.notes.forEach((n) => inst.triggerAttackRelease(Tone.Frequency(n, 'midi').toFrequency(), dt * 3, t, i === 0 ? 0.75 : 0.6))
      timers.current.push(window.setTimeout(() => setBeat(i), (i * dt + 0.05) * 1000))
    })
    timers.current.push(window.setTimeout(() => (loop ? playPattern(true) : setBeat(null)), strokes.length * dt * 1000 + 250))
  }

  useEffect(() => {
    if (rec.recording || !rec.take.length) return
    const seq = strokes.map((s) => s.notes)
    // Rasgueo = todas las cuerdas casi a la vez: se evalúa como bloque.
    setReport(evaluateTake(snapToTargets(rec.take, target), seq, strokes[0]?.strum ? 'bloque' : pattern))
  }, [rec.take])

  // Puntos del mástil: la posición, el paso actual resaltado y lo que pulsas.
  const dots: FretDot[] = []
  if (shape) {
    const now = new Set(tab === 'pasos' ? steps[step]?.notes ?? [] : beat !== null ? strokes[beat]?.notes ?? [] : [])
    shape.notes.forEach((n) => dots.push({
      string: n.string, fret: n.fret, label: n.fret > 0 && n.finger ? String(n.finger) : undefined,
      // Con un paso o golpe activo, el resto va en gris para que destaque lo que toca ahora.
      mark: now.has(n.midi) ? 'target' : n.fret === 0 ? 'held' : now.size ? 'scale' : 'lh',
    }))
    pressed.forEach((m) => {
      const hit = shape.notes.find((n) => n.midi === m || (n.midi - m) % 12 === 0)
      if (hit) dots.push({ string: hit.string, fret: hit.fret, mark: 'pressed', label: hit.finger ? String(hit.finger) : undefined })
    })
  }
  const muted = shape ? shape.frets.map((f, i) => (f < 0 ? 6 - i : 0)).filter(Boolean) : []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal tutor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Cómo tocar ${symbol} en guitarra`}>
        <div className="row">
          <div>
            <div className="eyebrow">Cómo se toca en guitarra</div>
            <div className="chord-big" style={{ fontSize: 44 }}>{symbol}</div>
          </div>
          <div className="spacer" />
          <label className="small text-2 row" style={{ gap: 6 }}>Cejilla
            <select className="select" value={capo} onChange={(e) => setCapo(+e.target.value)} aria-label="Cejilla">
              {Array.from({ length: 8 }, (_, c) => <option key={c} value={c}>{c ? `traste ${c}` : 'sin cejilla'}</option>)}
            </select>
          </label>
          <button className="btn ghost sm" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {capo > 0 && shape && <p className="small text-2" style={{ margin: '6px 0 0' }}>Con cejilla en el {capo}: tocas la forma de <b>{shape.shape_of ?? shape.symbol}</b> y suena {symbol}.</p>}
        {err && <div className="error mt">{err}</div>}
        {!err && shapes.length === 0 && <div className="small muted mt">Buscando posiciones…</div>}

        {shape && (
          <>
            <div className="diagram-strip mt" role="listbox" aria-label="Posiciones">
              {shapes.map((s, i) => (
                <div key={s.diagram} role="option" aria-selected={i === sel} className="diagram-pick">
                  <ChordDiagram shape={s} size={0.8} active={i === sel} onClick={() => setSel(i)} />
                  <div className="small muted">{s.name}</div>
                </div>
              ))}
            </div>

            <div className="seg mt">
              <button className={tab === 'pasos' ? 'on' : ''} onClick={() => setTab('pasos')}>1 · Montar el acorde</button>
              <button className={tab === 'mano' ? 'on' : ''} onClick={() => setTab('mano')}>2 · Rasgueo y arpegio</button>
              <button className={tab === 'practica' ? 'on' : ''} onClick={() => setTab('practica')}>3 · Practicar y grabar</button>
            </div>

            <div className="stack mt" style={{ minWidth: 0 }}>
              <Fretboard dots={dots} muted={muted} capo={capo} frets={12} height={170} onDown={(m) => press(m)} onUp={(m) => release(m)} />
              <div className="row small text-2" style={{ gap: 14 }}>
                <span>número = dedo de la mano izquierda: 1 índice · 2 medio · 3 anular · 4 meñique</span>
                <span>○ al aire · × no suena</span>
              </div>

              {tab === 'pasos' && (
                <div className="tutor-steps">
                  {steps.map((s, i) => (
                    <div key={i} className={`tutor-step ${i === step ? 'on' : ''} ${done[i] ? 'done' : ''}`}
                         onClick={() => { setStep(i); strum(s.notes, 'down') }}>
                      <div className="row"><b>{done[i] ? '✓ ' : `${i + 1}. `}{s.title}</b><div className="spacer" />
                        <button className="btn sm ghost" aria-label="Escuchar paso" onClick={(e) => { e.stopPropagation(); strum(s.notes, 'down') }}><IconPlay /></button></div>
                      <div className="small text-2">{s.text}</div>
                    </div>
                  ))}
                  <div className="small muted">Modo espera: pulsa la nota del paso en el mástil o en tu teclado MIDI (vale cualquier octava) y pasa solo al siguiente.</div>
                </div>
              )}

              {tab === 'mano' && (
                <div className="stack">
                  <div className="row">
                    <select className="select" value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="Patrón">
                      {Object.entries(GUITAR_PATTERNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <label className="small text-2 row" style={{ gap: 8 }}>♩ = {bpm}
                      <input type="range" min={40} max={160} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
                    </label>
                    <button className="btn primary" onClick={() => playPattern(false)}><IconPlay /> Escuchar</button>
                    <button className="btn" onClick={() => playPattern(true)}>En bucle</button>
                    {beat !== null && <button className="btn ghost" onClick={stop}><IconStop /> Parar</button>}
                  </div>
                  <div className="arp-strip">
                    {strokes.map((s, i) => <span key={i} className={`arp-cell ${beat === i ? 'on' : ''}`}><span className="r">{s.label}</span></span>)}
                  </div>
                  <div className="small muted">p pulgar · i índice · m medio · a anular. El pulgar toca el bajo; i, m y a, las tres cuerdas agudas. ↓ rasgueo hacia el suelo, ↑ hacia arriba.</div>
                </div>
              )}

              {tab === 'practica' && (
                <div className="stack">
                  <div className="row">
                    <select className="select" value={pattern} onChange={(e) => setPattern(e.target.value)} disabled={rec.recording} aria-label="Patrón">
                      {Object.entries(GUITAR_PATTERNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {!rec.recording
                      ? <button className="btn primary" onClick={() => { setReport(null); rec.start() }}>● Grabar</button>
                      : <button className="btn primary rec-on" onClick={rec.stop}>■ Terminar toma</button>}
                    <button className="btn" onClick={() => playPattern(false)}><IconPlay /> Modelo</button>
                    <button className="btn" disabled={!rec.take.length} onClick={() => rec.play()}><IconPlay /> Tu toma</button>
                    <button className="btn sm ghost" disabled={!rec.take.length} onClick={() => downloadMidi(`toma ${symbol}`, notesToMidi(rec.take))}>Exportar toma .mid</button>
                  </div>
                  {rec.recording && <div className="small" style={{ color: 'var(--coral)' }}>Grabando… toca el patrón en el mástil o en tu teclado y pulsa «Terminar toma».</div>}
                  {report && (
                    <div className="report fade-in">
                      <div className="score-ring" style={{ ['--p' as string]: report.score }}><span>{report.score}</span></div>
                      <div className="stack" style={{ gap: 4 }}>{report.messages.map((m, i) => <div key={i} className="small">{m}</div>)}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="finger-table">
                {[...shape.notes].sort((a, b) => b.string - a.string).map((n) => (
                  <div key={n.string} className="row" style={{ gap: 8 }}>
                    <span className="finger-badge" style={{ background: n.fret === 0 ? 'var(--teal)' : 'var(--accent)' }}>{n.fret === 0 ? '○' : n.finger}</span>
                    <span style={{ minWidth: 70 }}>{n.string}ª · {n.fret === 0 ? 'aire' : `traste ${n.fret}`}</span>
                    <b style={{ minWidth: 40 }}>{n.note}</b>
                    <span className="small text-2">{n.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
