import { lazy, Suspense } from 'react'
import ChordTutor from './ChordTutor'
import { useInstrument } from '../lib/instrument'

// El tutor de guitarra solo se descarga si se usa en modo guitarra.
const GuitarTutor = lazy(() => import('./GuitarTutor'))

/** «Cómo se toca» del instrumento elegido: piano (dos manos) o guitarra (posiciones y mano derecha). */
export default function HowToPlay({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const { isGuitar } = useInstrument()
  if (!isGuitar) return <ChordTutor symbol={symbol} onClose={onClose} />
  return <Suspense fallback={null}><GuitarTutor symbol={symbol} onClose={onClose} /></Suspense>
}
