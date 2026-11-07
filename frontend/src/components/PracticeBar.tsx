import { IconPlay, IconStop } from './Icons'
import { downloadMidi, progressionToMidi } from '../lib/midifile'
import { usePractice } from '../lib/practice'
import { usePersistentState } from '../lib/prefs'

/** Barra de práctica: tempo, pulsos por acorde, bucle, metrónomo y exportar a MIDI. */
export default function PracticeBar({ chords, name, onChord }: { chords: number[][]; name: string; onChord?: (i: number) => void }) {
  const [bpm, setBpm] = usePersistentState('practice.bpm', 80)
  const [beats, setBeats] = usePersistentState('practice.beats', 2)
  const [loop, setLoop] = usePersistentState('practice.loop', true)
  const [metro, setMetro] = usePersistentState('practice.metro', true)
  const { playing, beat, start, stop } = usePractice(chords, onChord)
  const opts = { bpm, beatsPerChord: beats, loop, metronome: metro }

  return (
    <div className="practice-bar">
      <button className="btn primary" onClick={() => (playing ? stop() : start(opts))} disabled={!chords.length}>
        {playing ? <><IconStop /> Parar</> : <><IconPlay /> Practicar</>}
      </button>
      <div className="beats">{Array.from({ length: beats }, (_, i) => <span key={i} className={i === beat ? 'on' : ''} />)}</div>
      <label className="small text-2 row" style={{ gap: 8 }}>♩ = {bpm}
        <input type="range" min={40} max={200} value={bpm} onChange={(e) => setBpm(+e.target.value)} disabled={playing} />
      </label>
      <label className="small text-2 row" style={{ gap: 6 }}>Pulsos/acorde
        <select className="select" style={{ padding: '4px 26px 4px 8px' }} value={beats} onChange={(e) => setBeats(+e.target.value)} disabled={playing}>
          {[1, 2, 3, 4, 8].map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} disabled={playing} /> Bucle</label>
      <label className="small text-2 row" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={metro} onChange={(e) => setMetro(e.target.checked)} disabled={playing} /> Metrónomo</label>
      <div className="spacer" />
      <button className="btn sm" disabled={!chords.length} onClick={() => downloadMidi(name, progressionToMidi(chords, bpm, beats))}>Exportar .mid</button>
    </div>
  )
}
