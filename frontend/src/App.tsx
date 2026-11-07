import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import * as I from './components/Icons'
import { useInput } from './lib/input'
import Lab from './pages/Lab'
import { EXTRA_ROUTES } from './pages/extra'

const NAV = [
  { section: 'Armonía' },
  { to: '/laboratorio', label: 'Laboratorio', icon: I.IconLab },
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
          {EXTRA_ROUTES.map((r) => <Route key={r.path} path={r.path} element={<r.element />} />)}
          <Route path="*" element={<Navigate to="/laboratorio" replace />} />
        </Routes>
      </main>
    </div>
  )
}
