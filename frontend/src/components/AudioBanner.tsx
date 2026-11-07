import { useEffect, useState } from 'react'
import { onAudioState, unlockAudio } from '../lib/audio'
import { subscribeMidi } from '../lib/midi'

/**
 * Aviso mientras el navegador tenga el sonido en pausa. Pasa sobre todo cuando lo
 * primero que haces es tocar el teclado MIDI: para el navegador eso no es un
 * "gesto", así que hace falta un clic en la página para activar el audio.
 */
export default function AudioBanner() {
  const [running, setRunning] = useState(true)
  const [midiTried, setMidiTried] = useState(false)
  useEffect(() => onAudioState(setRunning), [])
  useEffect(() => subscribeMidi((type) => { if (type === 'on') setMidiTried(true) }), [])
  if (running) return null
  return (
    <button className={`audio-banner ${midiTried ? 'urgent' : ''}`} onClick={unlockAudio}>
      <span>🔇</span>
      <span>
        <b>{midiTried ? 'Estás tocando pero el sonido está en pausa.' : 'El sonido está en pausa.'}</b>{' '}
        El navegador necesita un clic en la página para activarlo. Pulsa aquí.
      </span>
    </button>
  )
}
