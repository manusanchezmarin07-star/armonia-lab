import { useEffect, useState } from 'react'
import { useInput } from '../lib/input'
import { subscribeRaw } from '../lib/midi'
import { ACTIONS, controlName, controls, useControls, type Action } from '../lib/midiControls'
import { PC_NAMES, midiName } from '../lib/music'

const SOLF = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si']

/** Describe un mensaje MIDI en español para el monitor. */
function describe(b: number[]) {
  const cmd = b[0] & 0xf0
  if (cmd === 0x90 && b[2] > 0) return `Nota ${midiName(b[1])} (fuerza ${b[2]})`
  if (cmd === 0x80 || cmd === 0x90) return `Suelta ${midiName(b[1])}`
  if (cmd === 0xb0) return `${controlName(`cc:${b[1]}`)} = ${b[2]}`
  if (cmd === 0xe0) return `Pitch bend ${(((b[2] << 7) | b[1]) - 8192 > 0 ? '+' : '')}${Math.round(((((b[2] << 7) | b[1]) - 8192) / 8192) * 100)} %`
  if (cmd === 0xc0) return `Cambio de programa ${b[1]}`
  return b.map((x) => x.toString(16).padStart(2, '0')).join(' ')
}

/** Panel de ajustes del teclado MIDI: transporte, controles asignables y monitor. */
export default function MidiPanel({ onClose }: { onClose: () => void }) {
  const st = useControls()
  const { midi } = useInput()
  const [log, setLog] = useState<string[]>([])
  useEffect(() => subscribeRaw((b) => {
    if ((b[0] & 0xf0) === 0xf0) return // reloj y mensajes de sistema: ruido
    setLog((l) => [describe(b), ...l].slice(0, 8))
  }), [])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const t = st.transpose
  const playedIn = (target: number) => controls.setTranspose(((target + 6) % 12) - 6) // −6…+5: el camino más corto
  const mapped = (a: Action) => Object.entries(st.mappings).find(([, x]) => x === a)?.[0]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Teclado MIDI y controles">
        <div className="row">
          <div><div className="eyebrow">Ajustes</div><h2 style={{ margin: 0 }}>Teclado MIDI y controles</h2></div>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="row mt">
          <span className={`pill ${midi.devices.length ? 'teal' : ''}`}>{midi.devices.length ? midi.devices.join(', ') : 'Ningún teclado conectado'}</span>
        </div>

        <div className="grid grid-2 mt">
          <div className="card stack" style={{ background: 'var(--bg-2)' }}>
            <h3 style={{ margin: 0 }}>Transporte</h3>
            <div className="row">
              <button className="btn" onClick={() => controls.setTranspose(t - 1)}>−½</button>
              <div className="transpose-n">{t > 0 ? `+${t}` : t}</div>
              <button className="btn" onClick={() => controls.setTranspose(t + 1)}>+½</button>
              <button className="btn ghost sm" onClick={() => controls.setTranspose(0)} disabled={!t}>Quitar</button>
            </div>
            <div className="small text-2">
              {t === 0 ? 'Sin transporte: cada tecla suena como es.'
                : `Tocas Do → suena ${SOLF[((t % 12) + 12) % 12]}${Math.abs(t) >= 12 ? ` (${t > 0 ? '+' : ''}${Math.trunc(t / 12)} octava)` : ''}. La app analiza lo que suena.`}
            </div>
            <label className="small text-2">Tocar con las teclas de Do y que suene en:
              <select className="select" style={{ marginLeft: 8 }} value={((t % 12) + 12) % 12} onChange={(e) => playedIn(+e.target.value)}>
                {PC_NAMES.map((n, i) => <option key={n} value={i}>{n} mayor</option>)}
              </select>
            </label>
            <div className="small muted">Los botones de octava y transposición del propio Alesis cambian las notas que envía el teclado,
              así que también funcionan aquí directamente. Este transporte es el de la app y lo puedes asignar a botones abajo.</div>
          </div>

          <div className="card stack" style={{ background: 'var(--bg-2)' }}>
            <h3 style={{ margin: 0 }}>En directo</h3>
            <label className="small text-2">Volumen {Math.round(st.volume * 100)} %
              <input type="range" className="range" min={0} max={1} step={0.01} value={st.volume} onChange={(e) => controls.setVolume(+e.target.value)} />
            </label>
            <div className="small text-2">Vibrato (rueda de modulación): {Math.round(st.modulation * 100)} %</div>
            <div className="meter"><span style={{ width: `${st.modulation * 100}%` }} /></div>
            <div className="small text-2">Pitch bend: {Math.round(st.bend * 100)} %</div>
            <div className="meter bend"><span style={{ left: `${50 + Math.min(0, st.bend) * 50}%`, width: `${Math.abs(st.bend) * 50}%` }} /></div>
            {!st.bendWorks && <div className="small muted">Con el piano de cola el pitch bend no dobla la afinación (un piano real tampoco puede); sí funciona con el sonido de sintetizador.</div>}
            <div className="small muted">Pedal de sostenido (CC 64): funciona siempre.</div>
          </div>
        </div>

        <div className="card mt" style={{ background: 'var(--bg-2)' }}>
          <div className="row"><h3 style={{ margin: 0 }}>Controles asignables</h3><div className="spacer" />
            <button className="btn sm ghost" onClick={controls.resetMappings}>Restaurar</button></div>
          <p className="small text-2">Pulsa «Aprender» y mueve o pulsa el control de tu teclado (perilla, fader, botón o pad que envíe CC). Si un botón no
            hace nada aquí, mira el monitor: si no aparece ningún mensaje, ese botón solo actúa dentro del teclado.</p>
          <div className="map-list">
            {(Object.keys(ACTIONS) as Action[]).map((a) => {
              const id = mapped(a)
              return (
                <div key={a} className="map-row">
                  <div><b>{ACTIONS[a].label}</b><div className="small muted">{ACTIONS[a].help}</div></div>
                  <span className={`pill ${id ? 'accent' : ''}`}>{id ? controlName(id) : 'sin asignar'}</span>
                  {st.learning === a
                    ? <button className="btn sm primary rec-on" onClick={() => controls.learn(null)}>Mueve un control…</button>
                    : <button className="btn sm" onClick={() => controls.learn(a)}>Aprender</button>}
                  <button className="btn sm ghost" disabled={!id} onClick={() => id && controls.unmap(id)}>Quitar</button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card mt" style={{ background: 'var(--bg-2)' }}>
          <h3>Monitor MIDI (lo último que envía tu teclado)</h3>
          {log.length === 0 ? <div className="small muted">Toca una tecla o mueve un control…</div>
            : <div className="midi-log">{log.map((l, i) => <div key={i} className="mono small" style={{ opacity: 1 - i * 0.1 }}>{l}</div>)}</div>}
        </div>
      </div>
    </div>
  )
}
