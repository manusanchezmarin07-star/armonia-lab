import { useEffect, useRef, useState } from 'react'
import ChordDiagram from '../components/ChordDiagram'
import Fretboard, { type FretDot } from '../components/Fretboard'
import { IconPlay, IconStop } from '../components/Icons'
import MiniShape from '../components/MiniShape'
import Tab from '../components/Tab'
import { api } from '../lib/api'
import { Tone, click, ensureAudio } from '../lib/audio'
import { type CompasBeat, leadIn, scheduleBeat, type Stroke, strokeText } from '../lib/flamenco'
import type { Shape } from '../lib/guitar'
import { useInstrument } from '../lib/instrument'
import { usePersistentState } from '../lib/prefs'

interface Rasgueo { id: string; name: string; description: string; strokes: Stroke[] }
interface Tono { id: string; name: string; tonic: string; cadence: string[]; description: string }
interface Catalog { rasgueos: Rasgueo[]; tonos: Tono[]; palos: { id: string; name: string }[] }
interface Compas {
  palo: { id: string; name: string; beats: number; accents: number[]; bpm: number }
  tono: Tono; style: string; styles: Record<string, string>; capo: number
  beats: CompasBeat[]; shapes: Record<string, Shape | null>; note: string
}

const notesOf = (s: Shape | null | undefined) => (s ? [...s.notes].sort((a, b) => a.midi - b.midi).map((n) => n.midi) : [])

/**
 * Guitarra flamenca: el compás de cada palo tocado con rasgueo (con su tablatura y
 * notación de mano derecha), las técnicas de rasgueo una a una y la cadencia
 * andaluza en cada tono (por arriba, por medio…).
 */
export default function Flamenco() {
  const [cat, setCat] = useState<Catalog | null>(null)
  const { isGuitar, setInstrument } = useInstrument()
  const [palo, setPalo] = usePersistentState('flam.palo', 'solea')
  const [tono, setTono] = usePersistentState('flam.tono', 'arriba')
  const [style, setStyle] = usePersistentState('flam.style', 'basico')
  const [capo, setCapo] = usePersistentState('flam.capo', 0)
  const [palmas, setPalmas] = usePersistentState('flam.palmas', true)
  const palmasRef = useRef(palmas)
  palmasRef.current = palmas
  const [bpm, setBpm] = useState<number | null>(null)
  const [data, setData] = useState<Compas | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [beat, setBeat] = useState<number | null>(null)
  const [playing, setPlaying] = useState<string | null>(null) // qué se está reproduciendo
  const timers = useRef<number[]>([])
  const loopRef = useRef(false)

  useEffect(() => { api.get<Catalog>('/api/flamenco').then(setCat).catch((e) => setErr(e.message)) }, [])
  useEffect(() => {
    setErr(null)
    api.get<Compas>(`/api/flamenco/compas?palo=${palo}&tono=${tono}&style=${style}&capo=${capo}`)
      .then((d) => { setData(d); setBpm((b) => b ?? d.palo.bpm) }).catch((e) => setErr(e.message))
  }, [palo, tono, style, capo])
  useEffect(() => () => stop(), [])

  const stop = () => { loopRef.current = false; timers.current.forEach(clearTimeout); timers.current = []; setBeat(null); setPlaying(null) }

  /** Reproduce una secuencia de tiempos (con acorde por tiempo) y la repite si se pide. */
  const run = async (id: string, beats: { accent: boolean; strokes: Stroke[]; chord: string }[], shapes: Record<string, Shape | null>, tempo: number, loop: boolean) => {
    stop()
    await ensureAudio()
    loopRef.current = loop
    setPlaying(id)
    const sec = 60 / tempo
    const once = () => {
      const t0 = Tone.now() + 0.08 + leadIn(beats, sec)
      beats.forEach((b, k) => {
        scheduleBeat(b, notesOf(shapes[b.chord]), t0 + k * sec, sec)
        // Palmas (metrónomo): fuertes en los acentos. Se lee la ref para poder quitarlas sin parar.
        if (palmasRef.current) click(b.accent, t0 + k * sec)
        timers.current.push(window.setTimeout(() => setBeat(k), (t0 - Tone.now() + k * sec) * 1000))
      })
      timers.current.push(window.setTimeout(() => (loopRef.current ? once() : stop()), (t0 - Tone.now() + beats.length * sec) * 1000))
    }
    once()
  }

  const tempo = bpm ?? data?.palo.bpm ?? 90
  const cur = data && beat !== null && playing === 'compas' ? data.beats[beat] : null
  const shownChord = cur?.chord ?? data?.beats[0]?.chord
  const shape = shownChord ? data?.shapes[shownChord] : null
  const dots: FretDot[] = shape ? shape.notes.map((n) => ({ string: n.string, fret: n.fret, mark: n.fret === 0 ? 'held' : 'lh', label: n.fret > 0 && n.finger ? String(n.finger) : undefined })) : []
  const muted = shape ? shape.frets.map((f, i) => (f < 0 ? 6 - i : 0)).filter(Boolean) : []
  const tonoInfo = cat?.tonos.find((t) => t.id === tono)

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Guitarra flamenca</div>
          <h1>Rasgueo y compás</h1>
          <p className="lead">El compás de cada palo con la mano derecha: dónde va el golpe, qué dedos rasguean y en qué acorde.
            Con tablatura, la cadencia andaluza «por arriba» y «por medio», y la cejilla donde la quieras.</p>
        </div>
      </div>

      <div className="card" data-tour="flamenco-form">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label><span className="label">Palo</span>
            <select className="select" value={palo} onChange={(e) => { setPalo(e.target.value); setBpm(null); stop() }} aria-label="Palo">
              {cat?.palos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label><span className="label">Tono</span>
            <select className="select" value={tono} onChange={(e) => setTono(e.target.value)} aria-label="Tono">
              {cat?.tonos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
          <label style={{ maxWidth: '100%' }}><span className="label">Mano derecha</span>
            <select className="select" style={{ maxWidth: '100%' }} value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Mano derecha">
              {data && Object.entries(data.styles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label><span className="label">Cejilla</span>
            <select className="select" value={capo} onChange={(e) => setCapo(+e.target.value)} aria-label="Cejilla">
              {Array.from({ length: 8 }, (_, c) => <option key={c} value={c}>{c ? `traste ${c}` : 'sin cejilla'}</option>)}
            </select></label>
          <label className="small text-2 row" style={{ gap: 8 }}>♩ = {tempo}
            <input type="range" min={40} max={260} value={tempo} onChange={(e) => setBpm(+e.target.value)} aria-label="Tempo" /></label>
          <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={palmas} onChange={(e) => setPalmas(e.target.checked)} /> Palmas (metrónomo)</label>
          <div className="spacer" />
          {playing === 'compas'
            ? <button className="btn" onClick={stop}><IconStop /> Parar</button>
            : <button className="btn primary" disabled={!data} onClick={() => data && run('compas', data.beats, data.shapes, tempo, true)}><IconPlay /> Tocar el compás</button>}
        </div>
      </div>
      {!isGuitar && (
        <div className="notice mt row">Esta pantalla es de guitarra y ahora estás en modo piano.
          <div className="spacer" /><button className="btn sm primary" onClick={() => setInstrument('guitarra')}>Cambiar a guitarra</button></div>
      )}
      {err && <div className="error mt">{err}</div>}

      {data && (
        <div className="grid grid-side mt">
          <div className="stack" style={{ minWidth: 0 }}>
            <div className="card stack">
              <div className="row">
                <h3 style={{ margin: 0 }}>{data.palo.name} {data.tono.name.toLowerCase()}</h3>
                <div className="spacer" />
                <span className="small muted">acentos en {data.palo.accents.join(' · ')}</span>
              </div>
              <div className="compas-strip" role="list" aria-label="Compás">
                {data.beats.map((b, k) => (
                  <div key={k} role="listitem" className={`compas-beat ${b.accent ? 'acc' : ''} ${beat === k && playing === 'compas' ? 'on' : ''}`}>
                    <div className="compas-n">{b.count}</div>
                    <div className="compas-chord">{k === 0 || data.beats[k - 1].chord !== b.chord ? b.chord : ''}</div>
                    <div className="compas-strokes">{b.strokes.map(strokeText).join(' ')}</div>
                  </div>
                ))}
              </div>
              <Tab current={playing === 'compas' ? beat : null}
                   columns={data.beats.map((b) => ({ frets: data.shapes[b.chord]?.frets ?? null, accent: b.accent, bottom: String(b.count), top: b.strokes.map(strokeText).join(' ') }))} />
              <p className="small muted" style={{ margin: 0 }}>{data.note} p pulgar · i índice · m medio · a anular · c meñique · ↓ hacia el suelo · ↑ hacia arriba · +G golpe en la tapa.</p>
            </div>

            <div className="card stack">
              <h3 style={{ margin: 0 }}>Técnicas de rasgueo</h3>
              <p className="small text-2" style={{ margin: 0 }}>Cada una suena sobre el acorde de reposo del tono ({tonoInfo?.tonic}). Empieza lento y sube el tempo cuando todos los golpes suenen igual.</p>
              <div className="grid grid-2">
                {cat?.rasgueos.map((r) => (
                  <div key={r.id} className="card-soft stack" style={{ gap: 6 }}>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <b style={{ flex: 1, minWidth: 0 }}>{r.name}</b>
                      {playing === r.id
                        ? <button className="btn sm" onClick={stop} aria-label={`Parar ${r.name}`}><IconStop /></button>
                        : <button className="btn sm primary" aria-label={`Escuchar ${r.name}`}
                                  onClick={() => {
                                    const tonic = data.tono.cadence[data.tono.cadence.length - 1]
                                    run(r.id, Array.from({ length: 4 }, () => ({ accent: false, strokes: r.strokes, chord: tonic })), data.shapes, Math.min(tempo, 100), true)
                                  }}><IconPlay /></button>}
                    </div>
                    <div className="rasgueo-notation">{r.strokes.map((s, k) => <span key={k} className={s.golpe ? 'g' : ''}>{strokeText(s)}</span>)}</div>
                    <div className="small text-2">{r.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="stack" style={{ minWidth: 0 }}>
            <div className="card stack" style={{ alignItems: 'center' }}>
              <div className="small muted">{cur ? `Tiempo ${cur.count}` : 'Acorde'}{capo ? ` · cejilla en el ${capo}` : ''}</div>
              {shape && <ChordDiagram shape={shape} size={1.2} active />}
              {shape && capo > 0 && <div className="small text-2">suena {shownChord}</div>}
            </div>
            <div className="card stack">
              <h3 style={{ margin: 0 }}>Cadencia andaluza</h3>
              <p className="small text-2" style={{ margin: 0 }}>{tonoInfo?.description}</p>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {data.tono.cadence.map((c) => <MiniShape key={c} symbol={c} />)}
              </div>
              <button className="btn" onClick={() => run('cadencia', data.tono.cadence.flatMap((c) => [
                { accent: true, strokes: [{ f: 'i', dir: 'down' as const, golpe: true }], chord: c },
                { accent: false, strokes: [{ f: 'i', dir: 'down' as const, golpe: false }, { f: 'i', dir: 'up' as const, golpe: false }], chord: c },
              ]), data.shapes, 72, false)}><IconPlay /> Escuchar {data.tono.cadence.join(' – ')}</button>
            </div>
          </div>
        </div>
      )}

      {shape && (
        <div className="card mt">
          <Fretboard dots={dots} muted={muted} capo={capo} frets={12} height={170} />
        </div>
      )}
    </div>
  )
}
