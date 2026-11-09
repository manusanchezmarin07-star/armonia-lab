import { useInstrument } from '../lib/instrument'

/** Interruptor piano / guitarra. `big` para la cabecera de Inicio. */
export default function InstrumentSwitch({ big }: { big?: boolean }) {
  const { instrument, setInstrument } = useInstrument()
  return (
    <div className={`instrument-switch ${big ? 'big' : ''}`} role="radiogroup" aria-label="Instrumento">
      <button role="radio" aria-checked={instrument === 'piano'} className={instrument === 'piano' ? 'on' : ''} onClick={() => setInstrument('piano')}>
        <span aria-hidden>🎹</span> Piano
      </button>
      <button role="radio" aria-checked={instrument === 'guitarra'} className={instrument === 'guitarra' ? 'on' : ''} onClick={() => setInstrument('guitarra')}>
        <span aria-hidden>🎸</span> Guitarra
      </button>
    </div>
  )
}
