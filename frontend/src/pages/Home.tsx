import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInput } from '../lib/input'
import { useTour } from '../components/Tour'
import { useInstrument } from '../lib/instrument'
import GuitarArt, { GUITAR } from '../components/cover/GuitarArt'
import PianoArt, { PIANO } from '../components/cover/PianoArt'
import { GUITAR_PARTS, PIANO_PARTS, STAGE, labelRows, type Part } from '../components/cover/anatomy'
import { MODULES, modulesFor } from '../routes'

// Una idea de estudio por día: recursos concretos que se pueden probar en la app.
const TIPS = [
  { t: 'Sustituto tritonal', d: 'Cambia el G7 de una ii–V–I por Db7: el bajo baja por semitonos (D–Db–C).', to: '/rearmonizar' },
  { t: 'Dominante negativa', d: 'En lugar de G7 → C, prueba Fm6 → C. Misma fuerza, color oscuro: sello de Jacob Collier.', to: '/negativa' },
  { t: 'Bisagra disminuida', d: 'Bdim7 resuelve a C, Eb, F# o A: un solo acorde abre cuatro puertas.', to: '/puentes' },
  { t: 'Mediante cromática', d: 'C → Ab o C → E: comparten una nota y el cambio suena a banda sonora.', to: '/rearmonizar' },
  { t: 'Lidio', d: 'Toca un acorde mayor con la #11 encima (Cmaj7#11): ese brillo flotante es el lidio.', to: '/escalas' },
  { t: 'Backdoor', d: 'Bb7 → C en vez de G7 → C: llega a la tónica subiendo un tono, muy góspel.', to: '/rearmonizar' },
  { t: 'Soleá', d: 'Cuenta 12 tiempos y acentúa 3, 6, 8, 10 y 12. Practica a 60 hasta que salga sola.', to: '/ritmo' },
]
type Kind = 'piano' | 'guitarra'
const SEEN = 'armonia:portada-vista'

/**
 * Portada. Primero, los dos instrumentos flotando: se elige con cuál estudiar. El
 * elegido se amplía y cada función de la app aparece colgada de una de sus partes
 * (el puente lleva a «Puentes y modulaciones», el atril a «Lectura»…).
 */
export default function Home() {
  const { midi } = useInput()
  const { start } = useTour()
  const { instrument, setInstrument } = useInstrument()
  // En la misma sesión, al volver a Inicio se va directo al instrumento ya elegido.
  const [view, setView] = useState<Kind | null>(() => {
    try { return sessionStorage.getItem(SEEN) ? instrument : null } catch { return null }
  })
  const [hover, setHover] = useState<string | null>(null)
  const tip = TIPS[Math.floor(Date.now() / 86_400_000) % TIPS.length]

  const choose = (k: Kind) => {
    setInstrument(k)
    setView(k)
    try { sessionStorage.setItem(SEEN, '1') } catch { /* sin almacenamiento */ }
  }

  const head = (
    <header className="cover-head">
      <div className="brand"><img className="brand-mark" src="/favicon.svg" alt="" /><div className="brand-name">Armonía <em>Lab</em></div></div>
      <div className="spacer" />
      <button className="btn sm ghost" onClick={() => window.dispatchEvent(new Event('armonia:midi-panel'))}>
        <span className="dot" style={{ background: midi.devices.length ? 'var(--teal)' : 'var(--muted)' }} />
        {midi.devices.length ? midi.devices[0] : 'Sin teclado MIDI'}
      </button>
      <button className="btn sm" onClick={() => start('general')}>▶ Tour guiado</button>
    </header>
  )

  if (!view) {
    return (
      <div className="cover">
        {head}
        <div className="cover-title fade-in">
          <div className="eyebrow">Tu laboratorio de armonía</div>
          <h1>¿Con qué estudias hoy?</h1>
          <p className="lead">Elige instrumento y la app entera se adapta a él: el sonido, los acordes y la forma de enseñártelo.</p>
        </div>
        <div className="cover-choose" data-tour="cover-instruments">
          {([['piano', 'Piano', 'Teclado, dos manos y digitación', PIANO, <PianoArt key="p" />],
            ['guitarra', 'Guitarra', 'Clásica y flamenca: posiciones, rasgueo y cejilla', GUITAR, <GuitarArt key="g" />]] as const).map(([k, name, sub, size, art]) => (
            <button key={k} className={`cover-pick ${k}`} onClick={() => choose(k)} aria-label={`Estudiar con ${name.toLowerCase()}`}>
              <svg viewBox={`0 0 ${size.w} ${size.h}`} className="cover-art" aria-hidden>{art}</svg>
              <span className="cover-pick-name">{name}</span>
              <span className="small text-2">{sub}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const isGuitar = view === 'guitarra'
  const parts = isGuitar ? GUITAR_PARTS : PIANO_PARTS
  const size = isGuitar ? GUITAR : PIANO
  // El instrumento ocupa el centro del escenario; scale y desplazamiento para pasar de sus coordenadas a las del escenario.
  const scale = (STAGE.h - 30) / size.h
  const ox = (STAGE.w - size.w * scale) / 2
  const oy = 15
  const at = (p: Part) => ({ x: ox + p.x * scale, y: oy + p.y * scale })
  const rows = [...labelRows(parts, 'L'), ...labelRows(parts, 'R')]
  const moduleOf = (path: string) => MODULES.find((m) => m.path === path)
  const others = modulesFor(view).filter((m) => !parts.some((p) => p.path === m.path))

  return (
    <div className="cover">
      {head}
      <div className="cover-title compact fade-in">
        <h1>{isGuitar ? 'Tu guitarra, pieza a pieza' : 'Tu piano, pieza a pieza'}</h1>
        <button className="btn sm ghost" onClick={() => setView(null)}>← Elegir otro instrumento</button>
      </div>
      <div className={`anatomy ${view}`} style={{ aspectRatio: `${STAGE.w} / ${STAGE.h}` }}>
        <svg viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} className="anatomy-svg" aria-hidden>
          <g className="anatomy-lines">
            {rows.map(({ part, y }) => {
              const a = at(part)
              const left = part.side === 'L'
              const x0 = left ? 338 : STAGE.w - 338
              return (
                <polyline key={part.path} className={hover === part.path ? 'on' : ''} fill="none"
                          points={`${x0},${y} ${left ? x0 + 34 : x0 - 34},${y} ${a.x},${a.y}`} />
              )
            })}
          </g>
          <g transform={`translate(${ox} ${oy}) scale(${scale})`} className="anatomy-art">{isGuitar ? <GuitarArt /> : <PianoArt />}</g>
          {/* Los puntos van encima del dibujo para que se vea qué pieza señala cada línea. */}
          <g className="anatomy-dots">
            {rows.map(({ part }) => <circle key={part.path} cx={at(part).x} cy={at(part).y} r={hover === part.path ? 9 : 5} className={hover === part.path ? 'on' : ''} />)}
          </g>
        </svg>
        <nav className="anatomy-labels" aria-label="Funciones de la app">
          {rows.map(({ part, y }) => {
            const m = moduleOf(part.path)
            if (!m) return null
            return (
              <Link key={part.path} to={part.path} className={`part-label ${part.side === 'L' ? 'left' : 'right'} ${hover === part.path ? 'on' : ''}`}
                    style={{ top: `${(y / STAGE.h) * 100}%` }} onMouseEnter={() => setHover(part.path)} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(part.path)} onBlur={() => setHover(null)}>
                <span className="part-name">{part.part}</span>
                <b>{m.label}</b>
                <small>{part.hint}</small>
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="cover-foot">
        {others.length > 0 && (
          <div className="row small">
            <span className="muted">También:</span>
            {others.map((m) => <Link key={m.path} to={m.path} className="pill">{m.label}</Link>)}
          </div>
        )}
        <Link to={tip.to} className="cover-tip"><span className="eyebrow" style={{ margin: 0 }}>Idea de hoy</span> <b>{tip.t}.</b> {tip.d}</Link>
      </div>
    </div>
  )
}
