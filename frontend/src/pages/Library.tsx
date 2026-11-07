import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconTrash } from '../components/Icons'
import { api, type LibraryEntry } from '../lib/api'

const ARTISTS = ['Jacob Collier', 'J. S. Bach', 'Vicente Marín Trío', 'Emily Bear', 'Otro']
const EMPTY = { title: '', artist: ARTISTS[0], key: '', progression: '', notes: '', source: 'transcripción propia' }

export default function Library() {
  const [items, setItems] = useState<LibraryEntry[]>([])
  const [filter, setFilter] = useState('Todos')
  const [form, setForm] = useState(EMPTY)
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  const load = () => api.get<LibraryEntry[]>('/api/library').then(setItems)
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.progression.trim()) return
    await api.post('/api/library', { ...form, key: form.key || null, title: form.title || 'Sin título' })
    setForm(EMPTY)
    setOpen(false)
    load()
  }

  const shown = items.filter((i) => filter === 'Todos' || i.artist === filter)

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Biblioteca</div>
          <h1>Tus transcripciones</h1>
          <p className="lead">Aquí guardas lo que sacas de oído o con el separador de pistas, organizado por artista. Todo se queda
            en tu disco (carpeta <span className="kbd">data</span>), nada sale de tu ordenador.</p>
        </div>
        <button className="btn primary" onClick={() => setOpen((v) => !v)}><IconPlus /> Nueva transcripción</button>
      </div>

      {open && (
        <div className="card fade-in" style={{ marginBottom: 18 }}>
          <div className="grid grid-3">
            <label><span className="label">Título</span><input className="input" style={{ width: '100%' }} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Canción · sección" /></label>
            <label><span className="label">Artista</span>
              <select className="select" style={{ width: '100%' }} value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })}>{ARTISTS.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
            <label><span className="label">Tonalidad (opcional)</span><input className="input" style={{ width: '100%' }} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="C, Am, F#..." /></label>
          </div>
          <label className="mt" style={{ display: 'block' }}><span className="label">Progresión</span>
            <textarea className="input" rows={2} style={{ width: '100%', fontFamily: 'var(--serif)', fontSize: 17 }} value={form.progression} onChange={(e) => setForm({ ...form, progression: e.target.value })} placeholder="Ebmaj7 Dm7 G7(b9) | Cm9 ..." />
          </label>
          <label className="mt" style={{ display: 'block' }}><span className="label">Notas</span>
            <input className="input" style={{ width: '100%' }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Minuto, qué te llamó la atención…" />
          </label>
          <div className="row mt"><button className="btn primary" onClick={save}>Guardar</button><button className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button></div>
        </div>
      )}

      <div className="seg" style={{ marginBottom: 16 }}>
        {['Todos', ...ARTISTS].map((a) => <button key={a} className={filter === a ? 'on' : ''} onClick={() => setFilter(a)}>{a}</button>)}
      </div>

      {shown.length === 0 ? (
        <div className="card empty-state">
          <p style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--text-2)', margin: '0 0 6px' }}>Aún no hay nada aquí</p>
          <p style={{ margin: 0 }}>Saca una progresión de oído, guárdala y analízala. Con el tiempo esta será tu propia enciclopedia armónica.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {shown.map((i) => (
            <div key={i.id} className="card stack" style={{ gap: 8 }}>
              <div className="row">
                <b style={{ fontSize: 16 }}>{i.title}</b>
                <div className="spacer" />
                <span className="pill accent">{i.artist}</span>
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text-2)' }}>{i.progression}</div>
              {i.notes && <div className="small muted">{i.notes}</div>}
              <div className="row">
                <button className="btn sm primary" onClick={() => nav(`/analizador?p=${encodeURIComponent(i.progression)}&k=${encodeURIComponent(i.key ?? '')}`)}>Analizar</button>
                <div className="spacer" />
                <button className="btn sm ghost" title="Borrar" onClick={() => confirm('¿Borrar esta transcripción?') && api.del(`/api/library/${i.id}`).then(load)}><IconTrash /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
