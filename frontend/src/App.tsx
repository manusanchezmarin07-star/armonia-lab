import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AudioBanner from './components/AudioBanner'
import Palette from './components/Palette'
import { IconHome } from './components/Icons'
import { useInput } from './lib/input'
import Home from './pages/Home'
import { MODULES } from './routes'

export default function App() {
  const { midi, octave } = useInput()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const sections = [...new Set(MODULES.map((m) => m.section))]
  // En móvil/tablet el menú es un cajón: se cierra al navegar.
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn ghost sm" aria-label="Menú" onClick={() => setMenuOpen((o) => !o)}>☰</button>
        <NavLink to="/" className="brand-name" style={{ color: 'inherit' }}>Armonía <em>Lab</em></NavLink>
        <span className="dot" style={{ background: midi.devices.length ? 'var(--teal)' : 'var(--muted)', marginLeft: 'auto' }} />
      </header>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <NavLink to="/" className="brand" style={{ color: 'inherit' }}>
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <div className="brand-name">Armonía <em>Lab</em></div>
        </NavLink>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><IconHome /> Inicio</NavLink>
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
          <div className="muted">Buscar pantalla: <span className="kbd">Ctrl</span>+<span className="kbd">K</span></div>
        </div>
      </aside>
      {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />}
      <main className="main">
        <AudioBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          {MODULES.map((m) => <Route key={m.path} path={m.path} element={<m.element />} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Palette />
    </div>
  )
}
