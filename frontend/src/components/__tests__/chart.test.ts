import { describe, expect, it } from 'vitest'
import { barGrid, buildBars } from '../ChordChart'

const seg = (start: number, end: number, symbol: string) => ({ start, end, symbol, confidence: 0.9, edited: false })

describe('tabla de acordes por compases', () => {
  const beats = Array.from({ length: 16 }, (_, i) => i * 0.5) // 120 bpm: compases de 2 s
  it('agrupa en compases de 4 pulsos y pone cada acorde en su compás', () => {
    const bars = buildBars([seg(0, 2, 'C'), seg(2, 4, 'Am'), seg(4, 5, 'F'), seg(5, 6, 'G7'), seg(6, 8, 'C')], beats, 8)
    expect(bars).toHaveLength(4)
    expect(bars.map((b) => b.items.map((i) => i.symbol))).toEqual([['C'], ['Am'], ['F', 'G7'], ['C']])
  })
  it('ignora silencios y no repite un acorde que continúa dentro del compás', () => {
    const bars = buildBars([seg(0, 1, 'N'), seg(1, 4, 'C')], beats, 4)
    expect(bars[0].items.map((i) => i.symbol)).toEqual(['C'])
  })
  it('sin pulso fiable usa bloques de 2 segundos', () => {
    expect(buildBars([seg(0, 6, 'D')], [], 6)).toHaveLength(3)
  })
  it('alinea los compases con los cambios de acorde aunque haya anacrusa', () => {
    // Pulso cada 0,5 s; los acordes cambian cada 4 pulsos pero empiezan en el pulso 2 (anacrusa de 2).
    const beats = Array.from({ length: 34 }, (_, i) => i * 0.5)
    const segs = ['C', 'G', 'Am', 'F'].flatMap((sym, k) => [seg(1 + k * 2, 3 + k * 2, sym)])
    expect(barGrid(segs, beats)).toEqual({ offset: 2, perBar: 4 })
    const bars = buildBars(segs, beats, 17)
    expect(bars[0].start).toBe(0) // compás de anacrusa
    // Cada compás, un solo acorde entero.
    expect(bars.slice(1, 5).map((b) => b.items.map((x) => x.symbol))).toEqual([['C'], ['G'], ['Am'], ['F']])
  })
  it('detecta el compás de 3 (vals, sevillanas)', () => {
    const beats = Array.from({ length: 40 }, (_, i) => i * 0.5)
    const segs = ['C', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'C'].map((sym, k) => seg(k * 1.5, (k + 1) * 1.5, sym))
    expect(barGrid(segs, beats)).toEqual({ offset: 0, perBar: 3 })
  })
})
