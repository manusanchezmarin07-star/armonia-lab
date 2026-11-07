import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useInput } from './lib/input'
import { MODULES } from './routes'

export default function App() {
  const { midi, octave } = useInput()
  const sections = [...new Set(MODULES.map((m) => m.section))]
  return (
    <div className="app">
      <aside className="sidebar">
        <NavLink to="/" className="brand" style={{ color: 'inherit' }}>
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <div className="brand-name">Armonía <em>Lab</em></div>
        </NavLink>
        {sections.map((s) => (
          <div key={s}>
            <div className="nav-section">{s}</div>
            {MODULES.filter((m) => m.section === s).map((m) => (
              <NavLink key={m.path} to={m.path} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <m.icon /> {m.label}
              </NavLink>
            ))}
          </div>
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
          {MODULES.map((m) => <Route key={m.path} path={m.path} element={<m.element />} />)}
          <Route path="*" element={<Navigate to="/laboratorio" replace />} />
        </Routes>
      </main>
    </div>
  )
}
