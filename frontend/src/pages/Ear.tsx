import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Piano, { type Mark } from '../components/Piano'
import { IconPlay } from '../components/Icons'
import { MODES, matchesShape, pickWeighted, type EarItem, type EarMode } from '../lib/ear'
import { playChord, playSequence } from '../lib/audio'
import { useInput } from '../lib/input'
import { usePersistentState } from '../lib/prefs'
import { pcName } from '../lib/music'

type Stats = Record<string, { ok: number; ko: number }>
interface Question { item: EarItem; root: number; seq: number[][]; step: number }

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
const CADENCE = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]]

/** Construye lo que va a sonar para una pregunta. */
function build(mode: EarMode, item: EarItem, root: number, direction: string): { seq: number[][]; step: number } {
  const shape = item.shape
  if (mode.kind === 'interval') {
    const [a, b] = [root, root + (shape as number[])[1]]
    if (direction === 'armónico') return { seq: [[a, b]], step: 1.6 }
    return { seq: direction === 'descendente' ? [[b], [a]] : [[a], [b]], step: 0.8 }
  }
  if (mode.kind === 'chord') return { seq: [(shape as number[]).map((s) => root + s)], step: 1.8 }
  if (mode.kind === 'degree') {
    const cad = CADENCE.map((c) => [root - 12, ...c.map((s) => root + s)])
    return { seq: [...cad, [], [root - 12 + ((shape as number[])[0] % 12), ...(shape as number[]).map((s) => root + s)]], step: 0.75 }
  }
  return { seq: (shape as number[][]).map((c) => [root - 12 + (c[0] % 12), ...c.map((s) => root + s)]), step: 1.0 }
}

export default function Ear() {
  const [modeId, setModeId] = usePersistentState('ear.mode', 'intervalos')
  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0]
  const [allStats, setAllStats] = usePersistentState<Record<string, Stats>>('ear.stats', {})
  const [enabledMap, setEnabledMap] = usePersistentState<Record<string, string[]>>('ear.enabled', {})
  const [direction, setDirection] = usePersistentState('ear.direction', 'ascendente')
  const stats = allStats[mode.id] ?? {}
  const enabled = enabledMap[mode.id] ?? mode.items.slice(0, mode.kind === 'interval' ? 6 : mode.kind === 'chord' ? 4 : mode.items.length).map((i) => i.id)
  const pool = mode.items.filter((i) => enabled.includes(i.id))

  const [q, setQ] = useState<Question | null>(null)
  const [answer, setAnswer] = useState<{ id: string; ok: boolean } | null>(null)
  const [streak, setStreak] = useState(0)
  const [session, setSession] = useState({ ok: 0, total: 0 })
  const { lastChord, pressed } = useInput()
  const chordAtQuestion = useRef<number[]>(lastChord)

  const play = useCallback((qq: Question | null = q) => {
    if (qq) playSequence(qq.seq.filter((s) => s.length), qq.step)
  }, [q])

  const next = useCallback(() => {
    if (!pool.length) return
    const item = pickWeighted(pool, stats, q?.item.id)
    // Tónica aleatoria: entrenar el oído relativo, no memorizar alturas absolutas.
    const root = mode.kind === 'interval' ? randInt(55, 67) : randInt(57, 66)
    const nq = { item, root, ...build(mode, item, root, direction) }
    setQ(nq)
    setAnswer(null)
    chordAtQuestion.current = lastChord
    play(nq)
  }, [pool, stats, q, mode, direction, lastChord, play])

  useEffect(() => { setQ(null); setAnswer(null) }, [mode.id])

  const respond = useCallback((id: string) => {
    if (!q || answer) return
    const ok = id === q.item.id
    setAnswer({ id, ok })
    setStreak((s) => (ok ? s + 1 : 0))
    setSession((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }))
    setAllStats((all) => {
      const st = { ...(all[mode.id] ?? {}) }
      const cur = st[q.item.id] ?? { ok: 0, ko: 0 }
      st[q.item.id] = { ok: cur.ok + (ok ? 1 : 0), ko: cur.ko + (ok ? 0 : 1) }
      return { ...all, [mode.id]: st }
    })
  }, [q, answer, mode.id, setAllStats])

  // Respuesta por MIDI: al soltar las teclas se compara lo tocado con la respuesta correcta.
  useEffect(() => {
    if (!q || answer || !mode.midiAnswer || pressed.size || lastChord === chordAtQuestion.current || lastChord.length < 2) return
    const ok = matchesShape(lastChord, q.item, mode.kind, q.root % 12)
    respond(ok ? q.item.id : '__midi__')
  }, [pressed.size, lastChord])

  // Atajos: espacio = repetir/siguiente, números = responder.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!q || answer) next(); else play() }
      const n = parseInt(e.key, 10)
      if (!isNaN(n) && n >= 1 && n <= pool.length && q && !answer) respond(pool[n - 1].id)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [q, answer, next, play, pool, respond])

  const toggleItem = (id: string) => setEnabledMap((m) => {
    const cur = m[mode.id] ?? enabled
    const nextList = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    return { ...m, [mode.id]: nextList.length ? nextList : cur }
  })

  const marks: Record<number, Mark> = {}
  if (answer && q) q.seq[q.seq.length - 1].forEach((m) => (marks[m] = answer.ok ? 'held' : 'move'))

  const weakest = useMemo(() => mode.items.map((it) => {
    const s = stats[it.id] ?? { ok: 0, ko: 0 }
    const n = s.ok + s.ko
    return { it, n, acc: n ? s.ok / n : null }
  }), [stats, mode.items])

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Entrenamiento auditivo</div>
          <h1>Afina tu oído relativo</h1>
          <p className="lead">Ejercicios cortos con tónica aleatoria. Puedes responder con los botones, con los números del teclado o
            tocando la respuesta en tu MIDI. Lo que más fallas te sale más a menudo.</p>
        </div>
        <div className="row">
          <div className="stat"><div className="stat-n">{streak}</div><div className="stat-l">racha</div></div>
          <div className="stat"><div className="stat-n">{session.total ? Math.round((session.ok / session.total) * 100) : 0}%</div><div className="stat-l">aciertos hoy</div></div>
        </div>
      </div>

      <div className="grid grid-side-l" style={{ gridTemplateColumns: '280px minmax(0, 1fr)' }}>
        <div className="stack" data-tour="ear-modes">
          {MODES.map((m) => (
            <div key={m.id} className={`card mode-card ${m.id === mode.id ? 'on' : ''}`} onClick={() => setModeId(m.id)}>
              <b>{m.name}</b>
              <div className="small text-2" style={{ marginTop: 4 }}>{m.description}</div>
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="card ear-stage">
            {!q ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--text)', margin: '0 0 16px' }}>{mode.name}</p>
                <button className="btn primary" onClick={next} disabled={!pool.length}><IconPlay /> Empezar</button>
                <div className="small muted" style={{ marginTop: 12 }}>Atajo: <span className="kbd">Espacio</span></div>
              </div>
            ) : (
              <>
                <div className="row">
                  <button className="btn" onClick={() => play()}><IconPlay /> Repetir</button>
                  {mode.kind === 'interval' && (
                    <div className="seg">{['ascendente', 'descendente', 'armónico'].map((d) => (
                      <button key={d} className={d === direction ? 'on' : ''} onClick={() => setDirection(d)}>{d}</button>))}</div>
                  )}
                  {mode.kind === 'degree' && <span className="pill">Tonalidad: {pcName(q.root)} mayor</span>}
                  <div className="spacer" />
                  {mode.midiAnswer && <span className="small muted">o tócalo en el teclado{mode.kind === 'interval' ? ' (las dos notas a la vez)' : ''}</span>}
                </div>
                <div className="answers">
                  {pool.map((it, i) => {
                    const state = answer ? (it.id === q.item.id ? 'right' : it.id === answer.id ? 'wrong' : '') : ''
                    return (
                      <button key={it.id} className={`answer ${state}`} onClick={() => respond(it.id)} disabled={!!answer}>
                        <span className="answer-n">{i + 1}</span>{it.label}
                      </button>
                    )
                  })}
                </div>
                {answer && (
                  <div className={`feedback fade-in ${answer.ok ? 'ok' : 'ko'}`}>
                    <div>
                      <b>{answer.ok ? '¡Correcto!' : `Era: ${q.item.label}`}</b>
                      {!answer.ok && answer.id !== '__midi__' && (
                        <button className="btn sm ghost" style={{ marginLeft: 10 }}
                                onClick={() => { const w = mode.items.find((i) => i.id === answer.id)!; const b = build(mode, w, q.root, direction); playSequence(b.seq.filter((s) => s.length), b.step) }}>
                          Escuchar lo que elegiste
                        </button>
                      )}
                    </div>
                    <button className="btn primary" onClick={next}>Siguiente <span className="kbd">Espacio</span></button>
                  </div>
                )}
                {answer && <Piano from={36} to={84} marks={marks} height={90} />}
              </>
            )}
          </div>

          <div className="card">
            <h3>Qué practicar · tus aciertos</h3>
            <div className="ear-items">
              {weakest.map(({ it, n, acc }) => (
                <button key={it.id} className={`ear-item ${enabled.includes(it.id) ? 'on' : ''}`} onClick={() => toggleItem(it.id)}
                        title={n ? `${n} intentos` : 'Sin intentos todavía'}>
                  <span>{it.label}</span>
                  <span className="ear-bar"><span style={{ width: `${(acc ?? 0) * 100}%`, background: acc === null ? 'transparent' : acc > 0.8 ? 'var(--teal)' : acc > 0.5 ? 'var(--accent)' : 'var(--coral)' }} /></span>
                  <span className="small muted mono">{acc === null ? '—' : `${Math.round(acc * 100)}%`}</span>
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="small muted">Pulsa para activar o desactivar. Empieza con pocos y añade según aciertes.</span>
              <div className="spacer" />
              <button className="btn sm ghost" onClick={() => confirm('¿Borrar tus estadísticas de este ejercicio?') && setAllStats((a) => ({ ...a, [mode.id]: {} }))}>Reiniciar estadísticas</button>
            </div>
          </div>
          {mode.kind === 'chord' && q && answer && (
            <div className="small muted">Pista: el acorde sonó con fundamental {pcName(q.root)}. <button className="btn sm ghost" onClick={() => playChord(q.seq[0], 1.6, 0.12)}>Arpegiar</button></div>
          )}
        </div>
      </div>
    </div>
  )
}
