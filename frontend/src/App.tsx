import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import * as I from './components/Icons'
import { useInput } from './lib/input'
import Lab from './pages/Lab'
import Bridges from './pages/Bridges'
import Scales from './pages/Scales'
import Negative from './pages/Negative'
import Analyzer from './pages/Analyzer'
import { EXTRA_ROUTES } from './pages/extra'

const NAV = [
  { section: 'Armonía' },
  { to: '/laboratorio', label: 'Laboratorio', icon: I.IconLab },
  { to: '/puentes', label: 'Puentes y modulaciones', icon: I.IconBridge },
  { to: '/escalas', label: 'Escalas y simetría', icon: I.IconScale },
  { to: '/negativa', label: 'Armonía negativa', icon: I.IconMirror },
  { to: '/analizador', label: 'Analizador', icon: I.IconAnalyze },
  ...EXTRA_ROUTES.map((r) => ({ to: r.path, label: r.label, icon: r.icon })),
] as const

export default function App() {
  const { midi, octave } = useInput()
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <div className="brand-name">Armonía <em>Lab</em></div>
        </div>
        {NAV.map((n, i) =>
          'section' in n ? <div key={i} className="nav-section">{n.section}</div> : (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <n.icon /> {n.label}
            </NavLink>
          ))}
        <div className="sidebar-foot stack small">
          <div className="row">
            <span className="dot" style={{ background: midi.devices.length ? 'var(--teal)' : 'var(--muted)' }} />
            <span className="text-2">{midi.devices.length ? midi.devices.join(', ') : 'Sin teclado MIDI'}</span>
          </div>
          <div className="muted">Teclado del PC: <span className="kbd">A</span>–<span className="kbd">Ñ</span> · octava {octave} (<span className="kbd">Z</span>/<span className="kbd">X</span>)</div>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/laboratorio" replace />} />
          <Route path="/laboratorio" element={<Lab />} />
          <Route path="/puentes" element={<Bridges />} />
          <Route path="/escalas" element={<Scales />} />
          <Route path="/negativa" element={<Negative />} />
          <Route path="/analizador" element={<Analyzer />} />
          {EXTRA_ROUTES.map((r) => <Route key={r.path} path={r.path} element={<r.element />} />)}
          <Route path="*" element={<Navigate to="/laboratorio" replace />} />
        </Routes>
      </main>
    </div>
  )
}
