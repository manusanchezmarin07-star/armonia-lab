import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Piano, { type Mark } from '../components/Piano'
import ReadStaff, { type ReadNote } from '../components/ReadStaff'
import { IconPlay } from '../components/Icons'
import { playChord } from '../lib/audio'
import { useInput } from '../lib/input'
import { usePersistentState } from '../lib/prefs'

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SOLF: Record<string, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' }
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const midiOf = (n: ReadNote) => (n.octave + 1) * 12 + LETTER_PC[n.letter] + n.alter
const nameOf = (n: ReadNote) => `${SOLF[n.letter]}${n.alter === 1 ? '♯' : n.alter === -1 ? '♭' : ''}${n.octave}`

// Armaduras mayores con su número de alteraciones (orden del círculo de quintas).
const KEY_SIGS = [
  ['C', 'Do', 0], ['G', 'Sol', 1], ['D', 'Re', 2], ['A', 'La', 3], ['E', 'Mi', 4], ['B', 'Si', 5], ['F#', 'Fa♯', 6],
  ['F', 'Fa', -1], ['Bb', 'Si♭', -2], ['Eb', 'Mi♭', -3], ['Ab', 'La♭', -4], ['Db', 'Re♭', -5], ['Gb', 'Sol♭', -6],
] as const

interface Level { id: string; name: string; help: string; clefs: ('treble' | 'bass')[]; low: number; high: number; accidentals: boolean; chord: boolean; keysig?: boolean }

const LEVELS: Level[] = [
  { id: 'sol1', name: '1 · Clave de Sol (pentagrama)', clefs: ['treble'], low: 64, high: 77, accidentals: false, chord: false,
    help: 'Líneas de abajo arriba: Mi-Sol-Si-Re-Fa. Espacios: Fa-La-Do-Mi (forman la palabra FACE en inglés).' },
  { id: 'fa1', name: '2 · Clave de Fa (pentagrama)', clefs: ['bass'], low: 43, high: 57, accidentals: false, chord: false,
    help: 'Líneas: Sol-Si-Re-Fa-La. Espacios: La-Do-Mi-Sol. La clave marca el Fa en la 4ª línea con sus dos puntos.' },
  { id: 'ambas', name: '3 · Ambas claves y líneas adicionales', clefs: ['treble', 'bass'], low: 40, high: 84, accidentals: false, chord: false,
    help: 'El Do central está en una línea adicional justo debajo de la clave de Sol y justo encima de la de Fa.' },
  { id: 'alter', name: '4 · Con sostenidos y bemoles', clefs: ['treble', 'bass'], low: 43, high: 79, accidentals: true, chord: false,
    help: 'El sostenido (♯) sube medio tono: la tecla de la derecha. El bemol (♭) baja medio tono: la tecla de la izquierda.' },
  { id: 'acordes', name: '5 · Acordes (tríadas)', clefs: ['treble'], low: 60, high: 72, accidentals: false, chord: true,
    help: 'Lee de abajo arriba. Si las notas están "una línea, una línea, una línea" o "espacio-espacio-espacio" es una tríada en posición fundamental.' },
  { id: 'armaduras', name: '6 · Armaduras', clefs: ['treble'], low: 0, high: 0, accidentals: false, chord: false, keysig: true,
    help: 'Sostenidos: la tonalidad está medio tono por encima del último sostenido. Bemoles: es el penúltimo bemol.' },
]

interface Q { clef: 'treble' | 'bass'; notes: ReadNote[]; keySig?: (typeof KEY_SIGS)[number]; t0: number }

function randomNote(level: Level, clef: 'treble' | 'bass'): ReadNote {
  const [lo, hi] = level.id === 'ambas' ? (clef === 'treble' ? [57, 84] : [40, 64]) : [level.low, level.high]
  const whites: ReadNote[] = []
  for (let m = lo; m <= hi; m++) {
    const letter = LETTERS.find((l) => LETTER_PC[l] === m % 12)
    if (letter) whites.push({ letter, alter: 0, octave: Math.floor(m / 12) - 1 })
  }
  const n = whites[Math.floor(Math.random() * whites.length)]
  if (level.accidentals && Math.random() < 0.6) {
    // Se evitan Mi#, Si#, Dob y Fab: existen, pero no son lo que toca aprender primero.
    const opts = [1, -1].filter((a) => !((a === 1 && 'EB'.includes(n.letter)) || (a === -1 && 'CF'.includes(n.letter))))
    return { ...n, alter: opts[Math.floor(Math.random() * opts.length)] }
  }
  return n
}

function randomTriad(): ReadNote[] {
  const root = randomNote(LEVELS[4], 'treble')
  const i = LETTERS.indexOf(root.letter)
  // Tríada diatónica de Do mayor (todas naturales) apilando terceras por letras.
  return [0, 2, 4].map((k) => {
    const li = i + k
    return { letter: LETTERS[li % 7], alter: 0, octave: root.octave + Math.floor(li / 7) }
  })
}

export default function Reading() {
  const [levelId, setLevelId] = usePersistentState('read.level', 'sol1')
  const [exact, setExact] = usePersistentState('read.exact', false)
  const [labels, setLabels] = usePersistentState('read.labels', false)
  const [best, setBest] = usePersistentState<Record<string, number>>('read.best', {})
  const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0]
  const [q, setQ] = useState<Q | null>(null)
  const [result, setResult] = useState<{ ok: boolean; played: number[]; ms: number } | null>(null)
  const [streak, setStreak] = useState(0)
  const [times, setTimes] = useState<number[]>([])
  const [score, setScore] = useState({ ok: 0, total: 0 })
  const { pressed, press, release } = useInput()
  const prevPressed = useRef<Set<number>>(new Set())
  const chordBuffer = useRef<Set<number>>(new Set())

  const next = useCallback(() => {
    const clef = level.clefs[Math.floor(Math.random() * level.clefs.length)]
    if (level.keysig) {
      setQ({ clef: 'treble', notes: [], keySig: KEY_SIGS[Math.floor(Math.random() * KEY_SIGS.length)], t0: performance.now() })
    } else {
      setQ({ clef, notes: level.chord ? randomTriad() : [randomNote(level, clef)], t0: performance.now() })
    }
    setResult(null)
    chordBuffer.current = new Set()
  }, [level])

  useEffect(() => { setQ(null); setResult(null); setStreak(0); setTimes([]); setScore({ ok: 0, total: 0 }) }, [level.id])

  const evaluate = useCallback((played: number[]) => {
    if (!q || result || q.keySig) return
    const target = q.notes.map(midiOf)
    const norm = (ms: number[]) => [...new Set(ms.map((m) => (exact ? m : ((m % 12) + 12) % 12)))].sort((a, b) => a - b)
    const ok = JSON.stringify(norm(played)) === JSON.stringify(norm(target))
    const ms = performance.now() - q.t0
    setResult({ ok, played, ms })
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }))
    setStreak((s) => {
      const n = ok ? s + 1 : 0
      if (n > (best[level.id] ?? 0)) setBest((b) => ({ ...b, [level.id]: n }))
      return n
    })
    if (ok) setTimes((t) => [...t.slice(-19), ms])
  }, [q, result, exact, best, level.id, setBest])

  // Escucha el MIDI / teclado: notas sueltas se evalúan al pulsar; los acordes, al soltar todo.
  useEffect(() => {
    const prev = prevPressed.current
    const added = [...pressed].filter((m) => !prev.has(m))
    prevPressed.current = new Set(pressed)
    if (!q || result || q.keySig) return
    if (q.notes.length === 1 && added.length) evaluate([added[0]])
    if (q.notes.length > 1) {
      added.forEach((m) => chordBuffer.current.add(m))
      if (pressed.size === 0 && chordBuffer.current.size >= 2) evaluate([...chordBuffer.current])
    }
  }, [pressed])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && (!q || result)) { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [q, result, next])

  const answerKeySig = (k: string) => {
    if (!q?.keySig || result) return
    const ok = k === q.keySig[0]
    setResult({ ok, played: [], ms: performance.now() - q.t0 })
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }))
    setStreak((s) => (ok ? s + 1 : 0))
  }

  const target = q?.notes.map(midiOf) ?? []
  const marks: Record<number, Mark> = {}
  if (result) {
    target.forEach((m) => (marks[m] = 'held'))
    result.played.forEach((m) => { if (!target.includes(m)) marks[m] = 'move' })
  }
  const keyLabels = useMemo(() => {
    const l: Record<number, string> = {}
    if (labels) for (let m = 36; m <= 96; m++) { const letter = LETTERS.find((x) => LETTER_PC[x] === m % 12); if (letter) l[m] = SOLF[letter] }
    return l
  }, [labels])
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length / 1000 : 0
  const color = result ? (result.ok ? '#4fd1c5' : '#ff7a6b') : '#f1ece3'

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Lectura</div>
          <h1>Lee partituras sin pensar</h1>
          <p className="lead">Aparece una nota en el pentagrama y la tocas en tu piano, en el Alesis, en el teclado de abajo o en el del
            ordenador. Por niveles, de la clave de Sol a las armaduras. El objetivo es reconocerla sin contar líneas.</p>
        </div>
        <div className="row">
          <div className="stat"><div className="stat-n">{streak}</div><div className="stat-l">racha</div></div>
          <div className="stat"><div className="stat-n">{best[level.id] ?? 0}</div><div className="stat-l">récord</div></div>
          <div className="stat"><div className="stat-n">{avg ? avg.toFixed(1) + 's' : '—'}</div><div className="stat-l">tiempo medio</div></div>
        </div>
      </div>

      <div className="grid grid-side-l" style={{ gridTemplateColumns: '300px minmax(0, 1fr)' }}>
        <div className="stack">
          {LEVELS.map((l) => (
            <div key={l.id} className={`card mode-card ${l.id === level.id ? 'on' : ''}`} onClick={() => setLevelId(l.id)}>
              <b>{l.name}</b>
            </div>
          ))}
          <label className="row small text-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} /> Exigir la octava exacta
          </label>
          <label className="row small text-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Mostrar nombres en el teclado (ayuda)
          </label>
        </div>

        <div className="stack">
          <div className="card read-stage">
            <div className="read-paper">
              {q ? <ReadStaff clef={q.clef} notes={q.notes} keySig={q.keySig?.[0]} color={color} width={360} />
                 : <ReadStaff clef={level.clefs[0]} width={360} />}
            </div>
            <div className="stack" style={{ flex: 1, minWidth: 260 }}>
              {!q && (
                <>
                  <p className="explain" style={{ margin: 0 }}>{level.help}</p>
                  <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={next}><IconPlay /> Empezar <span className="kbd">Espacio</span></button>
                </>
              )}
              {q && !result && !q.keySig && <p className="explain" style={{ margin: 0 }}>Toca {q.notes.length > 1 ? 'el acorde (todas las notas a la vez)' : 'la nota'}…</p>}
              {q?.keySig && !result && (
                <>
                  <p className="explain" style={{ margin: 0 }}>¿Qué tonalidad mayor indica esta armadura?</p>
                  <div className="answers" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))' }}>
                    {KEY_SIGS.map(([k, name]) => <button key={k} className="answer" style={{ paddingLeft: 12 }} onClick={() => answerKeySig(k)}>{name}</button>)}
                  </div>
                </>
              )}
              {result && q && (
                <div className={`feedback fade-in ${result.ok ? 'ok' : 'ko'}`}>
                  <div>
                    <b>{result.ok ? '¡Bien!' : 'Casi'}</b>{' '}
                    {q.keySig ? `Era ${q.keySig[1]} mayor (${Math.abs(q.keySig[2])} ${q.keySig[2] >= 0 ? 'sostenidos' : 'bemoles'}).`
                      : `Era ${q.notes.map(nameOf).join(' – ')}.`}
                    <span className="small muted"> {(result.ms / 1000).toFixed(1)} s</span>
                  </div>
                  <div className="row">
                    {!q.keySig && <button className="btn sm ghost" onClick={() => playChord(target, 1.2)}>Escuchar</button>}
                    <button className="btn primary" onClick={next}>Siguiente <span className="kbd">Espacio</span></button>
                  </div>
                </div>
              )}
              {result && !result.ok && !q?.keySig && <p className="small text-2" style={{ margin: 0 }}>{level.help}</p>}
              <div className="small muted">Aciertos en esta sesión: {score.ok}/{score.total}</div>
            </div>
          </div>
          {!level.keysig && (
            <div className="card">
              <Piano from={36} to={96} marks={marks} labels={keyLabels} height={130} onDown={press} onUp={release} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
