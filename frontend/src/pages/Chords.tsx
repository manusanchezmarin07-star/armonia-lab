import { useEffect, useMemo, useState } from 'react'
import ChordDiagram from '../components/ChordDiagram'
import HowToPlay from '../components/HowToPlay'
import Piano, { type Mark } from '../components/Piano'
import { api } from '../lib/api'
import { playChord, strum } from '../lib/audio'
import type { Shape } from '../lib/guitar'
import { useInstrument } from '../lib/instrument'
import { usePersistentState } from '../lib/prefs'

interface Entry {
  symbol: string; name: string; level: number; formula: string[]
  tones: { label: string; name: string; note: string }[]
  pcs: number[]; notes: number[]; guitar: Shape | null
}
interface Catalog { root: string; roots: string[]; groups: { name: string; description: string; chords: Entry[] }[]; total: number }

const LEVELS: [number, string][] = [[1, 'Esenciales'], [2, '+ Intermedios'], [3, 'Todos']]
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const pcOf = (root: string) => (PC[root[0]?.toUpperCase()] + (root.includes('#') ? 1 : 0) - (root.slice(1).includes('b') ? 1 : 0) + 12) % 12

/**
 * Diccionario de acordes: todos los tipos sobre la fundamental que elijas, cada uno
 * con su fórmula, sus notas, cómo queda en el instrumento elegido (teclado o diagrama
 * de guitarra, nunca los dos) y un botón que abre su tutor.
 */
export default function Chords() {
  const [root, setRoot] = usePersistentState('dict.root', 'C')
  const [level, setLevel] = usePersistentState('dict.level', 1)
  const [query, setQuery] = useState('')
  const [data, setData] = useState<Catalog | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tutor, setTutor] = useState<string | null>(null)
  const { isGuitar, icon } = useInstrument()
  useEffect(() => {
    setErr(null)
    let live = true
    api.get<Catalog>(`/api/chords/catalog?root=${encodeURIComponent(root)}`)
      .then((d) => live && setData(d)).catch((e) => live && setErr(e.message))
    return () => { live = false }
  }, [root])

  // Buscar por cifrado: si empieza por una nota (F#m7…), se cambia a esa fundamental y se filtra por el resto.
  const q = query.trim()
  useEffect(() => {
    // Solo con mayúscula inicial, como se escribe un cifrado: «aumentada» o «disminuido» son
    // búsquedas por nombre, no los acordes de La o de Re.
    const m = /^([A-G])([#b]?)/.exec(q)
    if (m && m[1] + m[2] !== root) setRoot(m[1] + m[2])
  }, [q])
  const matches = (c: Entry) => !q || c.symbol.toLowerCase().startsWith(q.toLowerCase()) || c.name.toLowerCase().includes(q.toLowerCase())
  const groups = useMemo(() => (data?.groups ?? [])
    .map((g) => ({ ...g, chords: g.chords.filter((c) => (q ? matches(c) : c.level <= level)) }))
    .filter((g) => g.chords.length), [data, level, q])
  const shown = groups.reduce((n, g) => n + g.chords.length, 0)

  const listen = (c: Entry) => {
    if (isGuitar && c.guitar) strum([...c.guitar.notes].sort((a, b) => a.midi - b.midi).map((n) => n.midi), 'down', 22, 2.2)
    else playChord(c.notes, 1.8, 0.03)
  }
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Diccionario</div>
          <h1>Todos los acordes</h1>
          <p className="lead">Elige una nota y verás todos sus acordes, de las tríadas a los dominantes alterados: de qué notas se
            compone cada uno, cómo se toca en {isGuitar ? 'la guitarra' : 'el piano'} y un botón para que te lo enseñe paso a paso.</p>
        </div>
        {data && <div className="stat"><div className="stat-n">{data.total * 12}</div><div className="stat-l">acordes</div></div>}
      </div>

      <div className="card stack" data-tour="dict-controls">
        <div className="row" role="radiogroup" aria-label="Fundamental">
          {(data?.roots ?? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']).map((r) => (
            <button key={r} role="radio" aria-checked={pcOf(r) === pcOf(root)} className={`btn root-btn ${pcOf(r) === pcOf(root) ? 'primary' : ''}`}
                    onClick={() => { setRoot(r); setQuery('') }}>{r}</button>
          ))}
        </div>
        <div className="row">
          <div className="seg" role="radiogroup" aria-label="Nivel">
            {LEVELS.map(([n, label]) => <button key={n} role="radio" aria-checked={level === n} className={level === n ? 'on' : ''} onClick={() => setLevel(n)}>{label}</button>)}
          </div>
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Buscar: F#m7, Bb13, «semidisminuido»…" value={query}
                 onChange={(e) => setQuery(e.target.value)} aria-label="Buscar acorde" />
          <span className="small muted">{shown} acordes</span>
        </div>
      </div>
      {err && <div className="error mt">{err}</div>}
      {!data && !err && <div className="card mt muted">Preparando el diccionario…</div>}

      {data && q && shown === 0 && (
        <div className="card mt stack">
          <div>«{q}» no está en el diccionario, pero si es un cifrado válido puedo enseñarte a tocarlo igualmente:</div>
          <div className="row">
            <button className="btn primary" onClick={() => setTutor(q)}>{icon} Enséñame a tocarlo</button>
          </div>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.name} className="mt">
          <h2 style={{ marginBottom: 2 }}>{g.name}</h2>
          <p className="small text-2" style={{ marginTop: 0 }}>{g.description}</p>
          <div className="dict-grid">
            {g.chords.map((c) => {
              const marks: Record<number, Mark> = {}
              c.notes.forEach((m, i) => (marks[m] = i === 0 ? 'held' : 'target'))
              return (
                <article key={c.symbol} className="card dict-card" aria-label={c.symbol}>
                  <div className="row" style={{ alignItems: 'baseline', flexWrap: 'nowrap' }}>
                    <button className="dict-symbol" onClick={() => listen(c)} title="Escuchar">{c.symbol}</button>
                    <span className="small text-2" style={{ minWidth: 0 }}>{c.name}</span>
                  </div>
                  <div className="row" style={{ gap: 5 }}>
                    {c.tones.map((t) => <span key={t.label} className="pill" title={t.name}><b>{t.label}</b>&nbsp;{t.note}</span>)}
                  </div>
                  <div className="dict-views">
                    {/* Solo el instrumento elegido: el otro se ve cambiando el interruptor del menú. */}
                    {isGuitar
                      ? c.guitar && <ChordDiagram shape={c.guitar} size={0.9} />
                      : <div className="dict-piano"><Piano from={48} to={83} marks={marks} height={58} /></div>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm" onClick={() => setTutor(c.symbol)}>{icon} Enséñame a tocarlo</button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
      {tutor && <HowToPlay symbol={tutor} onClose={() => setTutor(null)} />}
    </div>
  )
}
