import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AudioBanner from './components/AudioBanner'
import Palette from './components/Palette'
import { TourHelpButton } from './components/Tour'
import MidiPanel from './components/MidiPanel'
import { startMidiControls, useControls } from './lib/midiControls'
import { IconHome } from './components/Icons'
import { useInput } from './lib/input'
import Home from './pages/Home'
import { MODULES } from './routes'

export default function App() {
  const { midi, octave } = useInput()
  const [menuOpen, setMenuOpen] = useState(false)
  const [midiOpen, setMidiOpen] = useState(false)
  const { transpose } = useControls()
  useEffect(() => startMidiControls(), [])
  // Otros componentes (p. ej. el Laboratorio) pueden abrir el panel con este evento.
  useEffect(() => {
    const open = () => setMidiOpen(true)
    window.addEventListener('armonia:midi-panel', open)
    return () => window.removeEventListener('armonia:midi-panel', open)
  }, [])
  const location = useLocation()
  const sections = [...new Set(MODULES.map((m) => m.section))]
  // En móvil/tablet el menú es un cajón: se cierra al navegar.
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn ghost sm" aria-label="Menú" onClick={() => setMenuOpen((o) => !o)}>☰</button>
        <NavLink to="/" className="brand-name" style={{ color: 'inherit' }}>Armonía <em>Lab</em></NavLink>
        {transpose !== 0 && <span className="pill accent" style={{ marginLeft: 'auto' }}>Transp. {transpose > 0 ? '+' : ''}{transpose}</span>}
        <button className="btn ghost sm" style={{ marginLeft: transpose ? 0 : 'auto' }} onClick={() => setMidiOpen(true)} aria-label="MIDI y controles">🎛</button>
        <span className="dot" style={{ background: midi.devices.length ? 'var(--teal)' : 'var(--muted)' }} />
      </header>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} data-tour="sidebar">
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
          <button className="btn sm" onClick={() => setMidiOpen(true)} data-tour="midi-button">
            🎛 MIDI y controles{transpose ? <span className="pill accent" style={{ marginLeft: 4 }}>{transpose > 0 ? '+' : ''}{transpose}</span> : null}
          </button>
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
      <TourHelpButton />
      {midiOpen && <MidiPanel onClose={() => setMidiOpen(false)} />}
    </div>
  )
}
