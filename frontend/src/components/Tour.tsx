import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { stepsFor, type TourStep } from '../lib/tours'

interface TourCtx { start: (scope: 'general' | string) => void; active: boolean }
const Ctx = createContext<TourCtx>({ start: () => {}, active: false })
export const useTour = () => useContext(Ctx)

type Rect = { top: number; left: number; width: number; height: number }
const PAD = 8

/**
 * Tour guiado: oscurece la pantalla, ilumina el elemento del paso (data-tour)
 * y muestra un cuadro con una flecha que lo señala. Cambia de pantalla solo.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<TourStep[]>([])
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const nav = useNavigate()
  const location = useLocation()
  const step = steps[i]

  const start = useCallback((scope: 'general' | string) => { setSteps(stepsFor(scope)); setI(0) }, [])
  const stop = useCallback(() => { setSteps([]); setRect(null) }, [])
  const next = useCallback(() => (i + 1 < steps.length ? setI(i + 1) : stop()), [i, steps.length, stop])
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), [])

  // Navega a la pantalla del paso y espera a que su elemento exista (la página carga datos).
  useEffect(() => {
    if (!step) return
    if (location.pathname !== step.route) { nav(step.route); return }
    setRect(null)
    if (!step.target) return
    let tries = 0
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      const visible = el && el.offsetParent !== null
      if (visible) {
        el!.scrollIntoView({ block: 'center', behavior: 'smooth' })
        window.setTimeout(() => measure(el!), 350)
      } else if (tries++ < 30) window.setTimeout(find, 100)
    }
    find()
  }, [step, location.pathname])

  const measure = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }
  useLayoutEffect(() => {
    if (!step?.target) return
    const re = () => { const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`); if (el) measure(el) }
    window.addEventListener('resize', re)
    window.addEventListener('scroll', re, true)
    return () => { window.removeEventListener('resize', re); window.removeEventListener('scroll', re, true) }
  }, [step])

  useEffect(() => {
    if (!step) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [step, next, prev, stop])

  return (
    <Ctx.Provider value={{ start, active: !!step }}>
      {children}
      {step && <TourOverlay step={step} rect={step.target ? rect : null} index={i} total={steps.length}
                            onNext={next} onPrev={prev} onClose={stop} />}
    </Ctx.Provider>
  )
}

function TourOverlay({ step, rect, index, total, onNext, onPrev, onClose }: {
  step: TourStep; rect: Rect | null; index: number; total: number; onNext: () => void; onPrev: () => void; onClose: () => void
}) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const W = Math.min(360, vw - 32)
  // Colocación del cuadro: debajo del elemento si cabe; si no, encima; si no, a un lado.
  let pos: { top: number; left: number }
  let arrow: 'up' | 'down' | 'left' | 'none' = 'none'
  if (!rect) {
    pos = { top: vh / 2 - 110, left: vw / 2 - W / 2 }
  } else if (rect.top + rect.height + 200 < vh) {
    pos = { top: rect.top + rect.height + 14, left: clamp(rect.left + rect.width / 2 - W / 2, 16, vw - W - 16) }
    arrow = 'up'
  } else if (rect.top > 220) {
    pos = { top: rect.top - 14 - 190, left: clamp(rect.left + rect.width / 2 - W / 2, 16, vw - W - 16) }
    arrow = 'down'
  } else {
    pos = { top: clamp(rect.top + 20, 16, vh - 230), left: clamp(rect.left + rect.width + 14, 16, vw - W - 16) }
    arrow = 'left'
  }
  const arrowX = rect ? clamp(rect.left + rect.width / 2 - pos.left, 24, W - 24) : 0

  return (
    <div className="tour-layer" role="dialog" aria-label={`Tour: ${step.title}`}>
      {rect ? <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
            : <div className="tour-dim" />}
      <div className={`tour-card arrow-${arrow}`} style={{ top: pos.top, left: pos.left, width: W, ['--ax' as string]: `${arrowX}px` }}>
        <div className="row">
          <span className="small muted mono">{index + 1} / {total}</span>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Cerrar tour">✕</button>
        </div>
        <div className="tour-title">{step.title}</div>
        <div className="text-2" style={{ fontSize: 14.5, lineHeight: 1.55 }}>{step.text}</div>
        <div className="tour-progress"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
        <div className="row">
          <button className="btn ghost sm" onClick={onClose}>Saltar</button>
          <div className="spacer" />
          {index > 0 && <button className="btn sm" onClick={onPrev}>← Anterior</button>}
          <button className="btn primary sm" onClick={onNext}>{index + 1 === total ? 'Terminar' : 'Siguiente →'}</button>
        </div>
      </div>
    </div>
  )
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Botón flotante «?» que lanza el tour de la pantalla actual. */
export function TourHelpButton() {
  const { start, active } = useTour()
  const { pathname } = useLocation()
  if (active || stepsFor(pathname).length === 0) return null
  return <button className="tour-help" onClick={() => start(pathname)} title="Tour de esta pantalla" aria-label="Tour de esta pantalla">?</button>
}
