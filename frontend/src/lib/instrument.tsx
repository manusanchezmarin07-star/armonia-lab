import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { setInstrumentKind, type InstrumentKind } from './audio'

// Instrumento con el que se estudia: cambia el sonido y la forma de mostrar las
// cosas (teclado de piano o mástil de guitarra) en toda la app.
interface Ctx { instrument: InstrumentKind; setInstrument: (k: InstrumentKind) => void; isGuitar: boolean }
const InstrumentCtx = createContext<Ctx>({ instrument: 'piano', setInstrument: () => {}, isGuitar: false })
const KEY = 'armonia:instrumento'

export function InstrumentProvider({ children }: { children: ReactNode }) {
  const [instrument, setState] = useState<InstrumentKind>(() => {
    try { return (localStorage.getItem(KEY) as InstrumentKind) === 'guitarra' ? 'guitarra' : 'piano' } catch { return 'piano' }
  })
  useEffect(() => {
    setInstrumentKind(instrument)
    try { localStorage.setItem(KEY, instrument) } catch { /* sin almacenamiento */ }
    document.documentElement.dataset.instrument = instrument
  }, [instrument])
  const setInstrument = useCallback((k: InstrumentKind) => setState(k), [])
  return <InstrumentCtx.Provider value={{ instrument, setInstrument, isGuitar: instrument === 'guitarra' }}>{children}</InstrumentCtx.Provider>
}

export const useInstrument = () => useContext(InstrumentCtx)
