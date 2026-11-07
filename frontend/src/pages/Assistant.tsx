import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

interface Source { n: number; title: string; heading: string; refs: string[] }
interface Reply { answer: string; mode: 'ia' | 'bot' | 'rechazo'; sources: Source[]; facts: string[]; warning?: string; model?: string }
interface Msg { role: 'user' | 'assistant'; content: string; meta?: Reply }
interface Status { available: boolean; model: string; model_ready: boolean; knowledge_chunks: number }

const SUGGESTIONS = [
  '¿Por qué el acorde disminuido sirve de puente entre tonalidades?',
  '¿Cuál es la armonía negativa de Dm7 G7 Cmaj7 en Do mayor?',
  '¿Qué diferencia hay entre dórico y eólico?',
  '¿Cómo se cuenta el compás de la soleá?',
  '¿Qué es un sustituto tritonal de G7?',
]

/** Markdown mínimo (negritas, listas, párrafos) renderizado como elementos React, sin HTML crudo. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>)
  const blocks = text.split(/\n{2,}/)
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s/.test(l))) {
          return <ul key={i} style={{ margin: '6px 0', paddingLeft: 20 }}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s/, ''))}</li>)}</ul>
        }
        const out: ReactNode[] = []
        lines.forEach((l, j) => { if (j) out.push(<br key={`br${j}`} />); out.push(<Fragment key={j}>{inline(l)}</Fragment>) })
        return <p key={i} style={{ margin: '6px 0' }}>{out}</p>
      })}
    </>
  )
}

export default function Assistant() {
  const [status, setStatus] = useState<Status | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { api.get<Status>('/api/assistant/status').then(setStatus).catch(() => {}) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const send = async (q = text) => {
    if (!q.trim() || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: q.trim() }]
    setMsgs(next)
    setText('')
    setBusy(true)
    try {
      const r = await api.post<Reply>('/api/assistant/chat', { messages: next.map(({ role, content }) => ({ role, content })) })
      setMsgs([...next, { role: 'assistant', content: r.answer, meta: r }])
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: `Error: ${(e as Error).message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Asistente</div>
          <h1>Pregúntame de música</h1>
          <p className="lead">Funciona en tu ordenador con Ollama. Los acordes y notas los calcula el motor de teoría (no la IA) y
            las explicaciones salen de tu base de conocimiento local, con fuentes. Solo habla de música.</p>
        </div>
        {status && (
          <span className={`pill ${status.available ? 'teal' : 'accent'}`}>
            {status.available ? `IA local · ${status.model}${status.model_ready ? '' : ' (no descargado)'}` : 'Modo bot (Ollama apagado)'} · {status.knowledge_chunks} fragmentos
          </span>
        )}
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 480 }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 10 }}>
          {msgs.length === 0 && (
            <div className="empty-state">
              <p style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--text)', margin: '0 0 14px' }}>¿Qué quieres entender hoy?</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                {SUGGESTIONS.map((s) => <button key={s} className="btn sm" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className="fade-in" style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <div style={{
                padding: '12px 16px', borderRadius: 14, lineHeight: 1.6,
                background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--bg-2)',
                border: `1px solid ${m.role === 'user' ? 'rgba(232,176,75,0.3)' : 'var(--line)'}`,
              }}>
                {m.role === 'assistant' ? <Rich text={m.content} /> : m.content}
              </div>
              {m.meta && (
                <div className="row small" style={{ marginTop: 6, gap: 6 }}>
                  <span className={`pill ${m.meta.mode === 'ia' ? 'teal' : m.meta.mode === 'bot' ? 'accent' : 'coral'}`}>
                    {m.meta.mode === 'ia' ? 'IA local' : m.meta.mode === 'bot' ? 'modo bot' : 'fuera de tema'}
                  </span>
                  {m.meta.facts.length > 0 && <span className="pill violet" title={m.meta.facts.join('\n')}>{m.meta.facts.length} hechos verificados</span>}
                  {m.meta.sources.map((s) => (
                    <span key={s.n} className="pill" title={s.refs.join('\n')}>[{s.n}] {s.title} · {s.heading}</span>
                  ))}
                  {m.meta.warning && <span className="pill coral">{m.meta.warning}</span>}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="muted small">Pensando…</div>}
          <div ref={endRef} />
        </div>
        <div className="row" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Ej.: ¿por qué Fm6 resuelve a C? · ¿qué es el modo lidio?" value={text}
                 onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button className="btn primary" onClick={() => send()} disabled={busy || !text.trim()}>Enviar</button>
        </div>
      </div>
    </div>
  )
}
