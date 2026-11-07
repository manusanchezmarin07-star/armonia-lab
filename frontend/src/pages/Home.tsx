import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useInput } from '../lib/input'
import { MODULES } from '../routes'

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

export default function Home() {
  const { midi } = useInput()
  const tip = TIPS[Math.floor(Date.now() / 86_400_000) % TIPS.length]
  const sections = [...new Set(MODULES.map((m) => m.section))]
  const progress = useMemo(() => {
    try {
      const ear = JSON.parse(localStorage.getItem('armonia:ear.stats') || '{}') as Record<string, Record<string, { ok: number; ko: number }>>
      let ok = 0, total = 0
      Object.values(ear).forEach((m) => Object.values(m).forEach((s) => { ok += s.ok; total += s.ok + s.ko }))
      const best = JSON.parse(localStorage.getItem('armonia:read.best') || '{}') as Record<string, number>
      return { earAcc: total ? Math.round((ok / total) * 100) : null, earTotal: total, readBest: Math.max(0, ...Object.values(best)) }
    } catch {
      return { earAcc: null, earTotal: 0, readBest: 0 }
    }
  }, [])

  return (
    <div className="page fade-in">
      <div className="hero">
        <div>
          <div className="eyebrow">Armonía Lab</div>
          <h1 className="hero-title">Entiende lo que tocas de oído.</h1>
          <p className="lead">Un laboratorio para estudiar la armonía de los grandes: por qué un cambio "imposible" suena natural,
            cómo viajar entre tonalidades y cómo leer, oír y tocar cada idea en tu piano.</p>
          <div className="row" style={{ marginTop: 20 }}>
            <Link to="/laboratorio" className="btn primary">Empezar a tocar</Link>
            <Link to="/rearmonizar" className="btn">Rearmonizar como Collier</Link>
            <span className={`pill ${midi.devices.length ? 'teal' : ''}`}>{midi.devices.length ? `MIDI conectado: ${midi.devices[0]}` : 'Conecta tu teclado por USB para tocar'}</span>
          </div>
        </div>
        <Link to={tip.to} className="card tip-card">
          <div className="eyebrow">Idea del día</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, margin: '4px 0 8px' }}>{tip.t}</div>
          <div className="text-2">{tip.d}</div>
          <div className="small" style={{ color: 'var(--accent)', marginTop: 12 }}>Probarlo →</div>
        </Link>
      </div>

      <div className="row" style={{ margin: '6px 0 26px' }}>
        <div className="stat"><div className="stat-n">{progress.earAcc ?? '—'}{progress.earAcc !== null && '%'}</div><div className="stat-l">acierto de oído</div></div>
        <div className="stat"><div className="stat-n">{progress.earTotal}</div><div className="stat-l">ejercicios de oído</div></div>
        <div className="stat"><div className="stat-n">{progress.readBest}</div><div className="stat-l">mejor racha leyendo</div></div>
      </div>

      {sections.map((s) => (
        <div key={s} style={{ marginBottom: 26 }}>
          <h3>{s}</h3>
          <div className="module-grid">
            {MODULES.filter((m) => m.section === s).map((m) => (
              <Link key={m.path} to={m.path} className="module-card">
                <span className="module-icon"><m.icon /></span>
                <div>
                  <div className="module-title">{m.label}</div>
                  <div className="small text-2">{m.blurb}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
