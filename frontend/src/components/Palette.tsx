import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { modulesFor } from '../routes'
import { useInstrument } from '../lib/instrument'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Buscador rápido de pantallas (Ctrl+K / Cmd+K). */
export default function Palette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); setQ(''); setI(0) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 10) }, [open])

  const { instrument } = useInstrument()
  const results = useMemo(() => modulesFor(instrument).filter((m) => norm(m.label + ' ' + m.blurb + ' ' + m.section).includes(norm(q))), [q, instrument])
  if (!open) return null
  const go = (path: string) => { nav(path); setOpen(false) }
  return (
    <div className="palette-backdrop" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input ref={input} className="input" placeholder="Ir a… (laboratorio, oído, Bach…)" value={q}
               onChange={(e) => { setQ(e.target.value); setI(0) }}
               onKeyDown={(e) => {
                 if (e.key === 'ArrowDown') setI((x) => Math.min(x + 1, results.length - 1))
                 if (e.key === 'ArrowUp') setI((x) => Math.max(x - 1, 0))
                 if (e.key === 'Enter' && results[i]) go(results[i].path)
               }} />
        <div className="palette-list">
          {results.map((m, k) => (
            <div key={m.path} className={`palette-item ${k === i ? 'on' : ''}`} onMouseEnter={() => setI(k)} onClick={() => go(m.path)}>
              <m.icon /><b>{m.label}</b><span className="small muted">{m.blurb}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
