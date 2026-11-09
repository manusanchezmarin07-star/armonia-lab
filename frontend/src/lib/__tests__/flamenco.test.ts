import { describe, expect, it } from 'vitest'
import { leadIn, strokeOffsets, strokeText, type Stroke } from '../flamenco'

const d = (f: string, dir: 'down' | 'up' = 'down', golpe = false): Stroke => ({ f, dir, golpe })

describe('notación y tiempo de los rasgueos', () => {
  it('escribe dedo, dirección y golpe', () => {
    expect([d('i'), d('i', 'up'), d('i', 'down', true)].map(strokeText)).toEqual(['i↓', 'i↑', 'i↓+G'])
  })
  it('índice abajo-arriba en corcheas y abanico en tresillo', () => {
    expect(strokeOffsets([d('i'), d('i', 'up')], 0.5)).toEqual([0, 0.5])
    expect(strokeOffsets([d('m'), d('p'), d('p', 'up')], 0.5).map((x) => +x.toFixed(3))).toEqual([0, 0.333, 0.667])
  })
  it('el rasgueo continuo termina en el pulso y necesita margen antes', () => {
    const c = [d('c'), d('a'), d('m'), d('i')]
    const offs = strokeOffsets(c, 0.5)
    expect(offs[3]).toBe(0)
    expect(offs[0]).toBeLessThan(0)
    expect(leadIn([{ strokes: c }], 0.5)).toBeCloseTo(0.135, 3)
  })
})
