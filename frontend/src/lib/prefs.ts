import { useEffect, useState } from 'react'

// Preferencias del usuario (tonalidad elegida, tempo...) guardadas en el navegador.
// Todo en try/catch: en modo privado localStorage puede fallar y la app debe seguir.
export function usePersistentState<T>(name: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const storageKey = `armonia:${name}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* sin almacenamiento */ }
  }, [storageKey, value])
  return [value, setValue]
}
