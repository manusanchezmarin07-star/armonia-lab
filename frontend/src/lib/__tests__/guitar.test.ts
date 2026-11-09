import { describe, expect, it } from 'vitest'
import { intoRange, layout, midiAt, positionsOf } from '../guitar'

describe('guitarra en el cliente', () => {
  it('posiciones de una nota', () => {
    expect(positionsOf(64)).toEqual([
      { string: 6, fret: 24 - 0 }, { string: 5, fret: 19 }, { string: 4, fret: 14 }, { string: 3, fret: 9 }, { string: 2, fret: 5 }, { string: 1, fret: 0 },
    ].filter((p) => p.fret <= 15))
    expect(midiAt({ string: 5, fret: 3 })).toBe(48) // Do3
  })
  it('lleva las notas al registro de la guitarra', () => {
    expect(intoRange(36)).toBe(48)
    expect(intoRange(100)).toBe(76)
  })
  it('coloca un acorde una nota por cuerda, sin cruzar cuerdas y en poco espacio', () => {
    const pos = layout([48, 52, 55, 60, 64]) // Do mayor abierto: x32010
    const strings = pos.map((p) => p.string)
    expect(new Set(strings).size).toBe(pos.length)
    expect([...strings].sort((a, b) => b - a)).toEqual(strings) // grave → agudo
    const fretted = pos.filter((p) => p.fret > 0).map((p) => p.fret)
    expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3)
    expect(pos.map(midiAt)).toEqual([48, 52, 55, 60, 64])
  })
})
