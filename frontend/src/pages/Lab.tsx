import { useEffect, useMemo, useState } from 'react'
import Piano, { type Mark } from '../components/Piano'
import Staff from '../components/Staff'
import KeySelect from '../components/KeySelect'
import { IconPlay } from '../components/Icons'
import { api, type Reading, type Transition } from '../lib/api'
import { playSequence } from '../lib/audio'
import { useInput } from '../lib/input'
import { fnColor, midiName } from '../lib/music'
import { usePersistentState } from '../lib/prefs'

interface IdentifyResult { notes: { midi: number; name: string }[]; readings: Reading[] }

export default function Lab() {
  const { pressed, press, release, lastChord, midi, soundOnMidi, setSoundOnMidi } = useInput()
  const [key, setKey] = usePersistentState('key', 'C')
  const [result, setResult] = useState<IdentifyResult | null>(null)
  const [slotA, setSlotA] = useState<string | null>(null)
  const [slotB, setSlotB] = useState<string | null>(null)
  const [trans, setTrans] = useState<Transition | null>(null)
  const [transErr, setTransErr] = useState<string | null>(null)

  const notes = pressed.size ? [...pressed].sort((a, b) => a - b) : lastChord

  useEffect(() => {
    if (notes.length < 2) { setResult(null); return }
    // Pequeño retardo: al tocar un acorde las notas llegan con milisegundos de
    // diferencia y no queremos analizar cada nota intermedia.
    const t = setTimeout(() => {
      api.post<IdentifyResult>('/api/chords/identify', { notes, key }).then(setResult).catch(() => setResult(null))
    }, 70)
    return () => clearTimeout(t)
  }, [notes.join(','), key])

  useEffect(() => {
    if (!slotA || !slotB) { setTrans(null); return }
    setTransErr(null)
    api.post<Transition>('/api/chords/transition', { from_chord: slotA, to_chord: slotB })
      .then(setTrans).catch((e) => { setTrans(null); setTransErr(e.message) })
  }, [slotA, slotB])

  const best = result?.readings[0]
  const spell = useMemo(() => {
    const s: Record<number, string> = {}
    best?.tones.forEach((t) => (s[t.pc] = t.note))
    return s
  }, [best])
  const marks: Record<number, Mark> = {}
  if (!pressed.size) lastChord.forEach((m) => (marks[m] = 'ghost'))

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">Laboratorio</div>
          <h1>Toca y entiende cada acorde</h1>
          <p className="lead">Toca en tu piano o en el Alesis, con el ratón o con el teclado del ordenador. Te digo qué acorde es,
            qué función tiene en la tonalidad y cómo conecta con el siguiente.</p>
        </div>
        <div className="row">
          <KeySelect value={key} onChange={setKey} label="Tonalidad de referencia" />
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <span className={`pill ${midi.devices.length ? 'teal' : ''}`}>
            {midi.devices.length ? `MIDI: ${midi.devices.join(', ')}` : midi.supported ? 'Conecta tu teclado MIDI por USB' : 'Este navegador no soporta MIDI (usa Chrome o Edge)'}
          </span>
          <label className="row small text-2" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={soundOnMidi} onChange={(e) => setSoundOnMidi(e.target.checked)} />
            Sonido para el teclado MIDI (desactívalo si tu piano ya suena)
          </label>
          <div className="spacer" />
          <span className="small muted">{notes.map(midiName).join(' · ') || 'Sin notas'}</span>
        </div>
        <Piano from={36} to={96} pressed={pressed} marks={marks} onDown={press} onUp={release} height={170} showNames />
      </div>

      <div className="grid grid-side mt">
        <div className="card">
          <div className="row" style={{ alignItems: 'flex-start', gap: 26 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3>Acorde</h3>
              <div className={`chord-big ${best ? '' : 'empty'}`}>{best?.symbol ?? '—'}</div>
              {best && (
                <div className="stack fade-in" style={{ marginTop: 14 }}>
                  <div className="row">
                    <span className="pill accent">{best.quality}</span>
                    <span className="pill">{best.inversion}</span>
                    {best.tensions.length > 0 && <span className="pill coral">tensiones: {best.tensions.join(', ')}</span>}
                    {best.omitted.length > 0 && <span className="pill">sin {best.omitted.join(', ')}</span>}
                  </div>
                  <div className="row">
                    {best.tones.map((t) => (
                      <div key={t.label} className="seq-item" style={{ minWidth: 70, cursor: 'default' }}>
                        <div className="sym" style={{ fontSize: 18 }}>{t.note}</div>
                        <div className="rn">{t.name}</div>
                      </div>
                    ))}
                  </div>
                  {result!.readings.length > 1 && (
                    <div className="small text-2">También se puede leer como{' '}
                      {result!.readings.slice(1, 4).map((r) => <span key={r.symbol} className="pill" style={{ marginRight: 6 }}>{r.symbol}</span>)}
                    </div>
                  )}
                </div>
              )}
              {!best && notes.length >= 2 && result && (
                <p className="explain">Sonoridad sin nombre estándar: <b>{result.notes.map((n) => n.name).join(' · ')}</b>.
                  Prueba a quitar alguna nota o a cambiar el bajo: muchos clusters son acordes conocidos con una nota añadida.</p>
              )}
              {!best && notes.length < 2 && <p className="muted">Toca al menos dos notas a la vez.</p>}
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 6 }}>
              <Staff notes={notes} spell={spell} width={250} />
            </div>
          </div>

          {best?.analysis && (
            <div className="mt fade-in" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
              <h3>En {key.endsWith('m') ? key.slice(0, -1) + ' menor' : key + ' mayor'}</h3>
              <div className="row" style={{ marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, color: fnColor(best.analysis.function) }}>
                  {best.analysis.roman}
                </span>
                <span className="pill violet">{best.analysis.kind}</span>
              </div>
              <p className="explain" style={{ margin: 0 }}>{best.analysis.explanation}</p>
            </div>
          )}
        </div>

        <div className="card stack">
          <h2>¿Cómo conectan dos acordes?</h2>
          <p className="small text-2" style={{ margin: 0 }}>Toca un acorde y guárdalo como A, luego otro como B. Te explico la relación y la conducción de voces más suave.</p>
          <div className="row">
            <button className="btn sm" disabled={!best} onClick={() => setSlotA(best!.symbol)}>Guardar como A</button>
            <button className="btn sm" disabled={!best} onClick={() => setSlotB(best!.symbol)}>Guardar como B</button>
          </div>
          <div className="row">
            <ChordSlot label="A" value={slotA} onChange={setSlotA} />
            <span className="muted">→</span>
            <ChordSlot label="B" value={slotB} onChange={setSlotB} />
          </div>
          {transErr && <div className="error">{transErr}</div>}
          {trans && (
            <div className="stack fade-in">
              <div className="row">
                <span className="pill teal">Notas comunes: {trans.common_tones.join(', ') || 'ninguna'}</span>
                <span className="pill">Bajo: {trans.root_motion}</span>
                <span className={`pill ${trans.smoothness.includes('suave') ? 'teal' : 'coral'}`}>{trans.smoothness} · {trans.motion} st</span>
              </div>
              {trans.relations.map((r, i) => <p key={i} className="explain" style={{ margin: 0 }}>• {r}</p>)}
              <button className="btn primary sm" style={{ alignSelf: 'flex-start' }}
                      onClick={() => playSequence(trans.voicing.map((v) => [v.bass, ...v.upper]), 1.3)}>
                <IconPlay /> Escuchar con buena conducción de voces
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ChordSlot({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  return (
    <input className="input" style={{ width: 130, fontFamily: 'var(--serif)', fontSize: 18 }} placeholder={`Acorde ${label}`}
           value={text} onChange={(e) => setText(e.target.value)}
           onBlur={() => onChange(text.trim() || null)} onKeyDown={(e) => e.key === 'Enter' && onChange(text.trim() || null)} />
  )
}
