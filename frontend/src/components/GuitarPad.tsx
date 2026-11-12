import { useEffect, useState } from 'react'
import Fretboard, { type FretDot } from './Fretboard'
import { IconPlay } from './Icons'
import { strum } from '../lib/audio'
import { layout, midiAt } from '../lib/guitar'

/**
 * Mástil para montar acordes con el ratón: cada clic deja pisada esa casilla (una
 * por cuerda, como en la guitarra; otro clic en la misma la suelta). Con el ratón
 * solo se puede pulsar una nota a la vez, así que sin esto era imposible formar un
 * acorde en pantalla. Lo que llega del teclado MIDI o del ordenador se dibuja encima.
 */
export default function GuitarPad({ pressed, onNotes, height = 190 }: {
  pressed: Set<number>; onNotes: (notes: number[]) => void; height?: number
}) {
  // Traste pisado en cada cuerda (índice 0 = 6ª) o null si no suena.
  const [frets, setFrets] = useState<(number | null)[]>([null, null, null, null, null, null])
  const notes = frets.map((f, i) => (f === null ? null : midiAt({ string: 6 - i, fret: f }))).filter((m): m is number => m !== null)
  useEffect(() => { onNotes(notes) }, [notes.join(',')])

  const dots: FretDot[] = frets.flatMap((f, i) => (f === null ? [] : [{ string: 6 - i, fret: f, mark: 'target' as const }]))
  layout([...pressed]).forEach((p) => dots.push({ ...p, mark: 'pressed' }))

  const toggle = (midi: number, pos: { string: number; fret: number }) => {
    const i = 6 - pos.string
    const off = frets[i] === pos.fret
    setFrets((cur) => cur.map((f, k) => (k === i ? (off ? null : pos.fret) : f)))
    if (!off) strum([midi], 'down', 0, 1.6, 0.8)
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Fretboard dots={dots} showNames height={height} onDown={toggle} />
      <div className="row small text-2">
        <span>Haz clic en las casillas para pisar un acorde (una por cuerda; clic otra vez para soltar).</span>
        <div className="spacer" />
        <button className="btn sm primary" disabled={notes.length < 2} onClick={() => strum(notes, 'down', 22, 2.2, 0.75)}><IconPlay /> Rasguear</button>
        <button className="btn sm ghost" disabled={!notes.length} onClick={() => setFrets([null, null, null, null, null, null])}>Soltar todo</button>
      </div>
    </div>
  )
}
