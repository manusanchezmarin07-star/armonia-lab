import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { downloadMidi, notesToMidi } from '../lib/midifile'
import { takeDurationMs, useRecorder, type RecordedNote } from '../lib/recorder'
import { IconPlay } from './Icons'

/**
 * Agrupa una toma en acordes: notas que empiezan casi a la vez (≤ 90 ms) forman un
 * mismo acorde. Así una progresión tocada en bloques se convierte en cifrado.
 */
export function groupChords(take: RecordedNote[], windowMs = 90): number[][] {
  const groups: number[][] = []
  let start = -Infinity
  take.forEach((n) => {
    if (n.start - start > windowMs) { groups.push([]); start = n.start }
    groups[groups.length - 1].push(n.note)
  })
  return groups.filter((g) => new Set(g.map((x) => x % 12)).size >= 2)
}

export default function RecorderCard() {
  const rec = useRecorder()
  const [chords, setChords] = useState<string[] | null>(null)
  const nav = useNavigate()

  const analyze = async () => {
    const groups = groupChords(rec.take)
    const names = await Promise.all(groups.map((g) =>
      api.post<{ readings: { symbol: string }[] }>('/api/chords/identify', { notes: g }).then((r) => r.readings[0]?.symbol).catch(() => undefined)))
    // Sin repetir acordes consecutivos iguales.
    setChords(names.filter((x): x is string => !!x).filter((x, i, a) => i === 0 || a[i - 1] !== x))
  }

  return (
    <div className="card stack" data-tour="lab-recorder">
      <div className="row">
        <h2 style={{ margin: 0 }}>Grabadora</h2>
        <div className="spacer" />
        {rec.recording ? <span className="pill coral">● grabando</span>
          : rec.take.length > 0 && <span className="pill">{rec.take.length} notas · {(takeDurationMs(rec.take) / 1000).toFixed(1)} s</span>}
      </div>
      <p className="small text-2" style={{ margin: 0 }}>Graba lo que tocas (MIDI, ratón o teclado), escúchalo, expórtalo a MIDI o deja que saque los acordes de tu toma.</p>
      <div className="row">
        {!rec.recording
          ? <button className="btn primary sm" onClick={() => { setChords(null); rec.start() }}>● Grabar</button>
          : <button className="btn primary sm rec-on" onClick={rec.stop}>■ Parar</button>}
        <button className="btn sm" disabled={!rec.take.length || rec.recording} onClick={() => rec.play()}><IconPlay /> Escuchar</button>
        <button className="btn sm" disabled={!rec.take.length || rec.recording} onClick={analyze}>Sacar acordes</button>
        <button className="btn sm ghost" disabled={!rec.take.length || rec.recording}
                onClick={() => downloadMidi('mi toma', notesToMidi(rec.take))}>Exportar .mid</button>
      </div>
      {chords && (
        <div className="stack fade-in" style={{ gap: 8 }}>
          {chords.length ? (
            <>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{chords.join('  ')}</div>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }}
                      onClick={() => nav(`/analizador?p=${encodeURIComponent(chords.join(' '))}`)}>Abrir en el Analizador →</button>
            </>
          ) : <div className="small muted">No he encontrado acordes: toca las notas de cada acorde a la vez.</div>}
        </div>
      )}
    </div>
  )
}
