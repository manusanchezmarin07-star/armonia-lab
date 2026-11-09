import { describe, expect, it } from 'vitest'
import { guitarSteps, guitarStrokes, snapToTargets } from '../guitarPatterns'
import type { Shape } from '../guitar'

// Do mayor de manual: x32010
const C: Shape = {
  symbol: 'C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barre: null, base_fret: 1, position: 1, name: 'C abierto', capo: 0, diagram: 'x32010',
  notes: [
    { string: 5, fret: 3, midi: 48, note: 'C3', role: 'fundamental', finger: 3 },
    { string: 4, fret: 2, midi: 52, note: 'E3', role: '3ª', finger: 2 },
    { string: 3, fret: 0, midi: 55, note: 'G3', role: '5ª', finger: 0 },
    { string: 2, fret: 1, midi: 60, note: 'C4', role: 'fundamental', finger: 1 },
    { string: 1, fret: 0, midi: 64, note: 'E4', role: '3ª', finger: 0 },
  ],
}

describe('patrones de mano derecha', () => {
  it('p-i-m-a: pulgar en el bajo y i, m, a en las tres cuerdas agudas', () => {
    expect(guitarStrokes(C, 'pima').map((s) => s.notes[0])).toEqual([48, 55, 60, 64])
  })
  it('el rasgueo toca todas las cuerdas que suenan', () => {
    expect(guitarStrokes(C, 'rasgueo')[0].notes).toEqual([48, 52, 55, 60, 64])
  })
})

describe('pasos para montar la posición', () => {
  it('un paso por dedo, del grave al agudo, y el acorde al final avisando de la 6ª apagada', () => {
    const s = guitarSteps(C)
    expect(s.map((x) => x.notes)).toEqual([[48], [52], [60], [48, 52, 55, 60, 64]])
    expect(s[0].title).toContain('Dedo 3')
    expect(s[3].text).toContain('6ª')
  })
})

describe('evaluación con teclado MIDI', () => {
  it('lleva cada nota a la octava de la guitarra si es de la misma clase', () => {
    const take = [{ note: 60, start: 0 }, { note: 76, start: 10 }, { note: 61, start: 20 }]
    expect(snapToTargets(take, [48, 52, 64]).map((t) => t.note)).toEqual([48, 64, 61])
  })
})
