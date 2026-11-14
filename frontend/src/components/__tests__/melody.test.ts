import { describe, expect, it } from 'vitest'
import { noteAt, type MelodyNote } from '../MelodyView'

const n = (start: number, end: number, midi: number): MelodyNote => ({ start, end, midi, name: '' })

describe('nota de la melodía que suena en cada instante', () => {
  const notes = [n(0, 1, 60), n(1, 1.5, 62), n(2, 3, 64)]
  it('encuentra la nota por tiempo', () => {
    expect(noteAt(notes, 0.5)).toBe(0)
    expect(noteAt(notes, 1)).toBe(1) // el final de una es el principio de la siguiente
    expect(noteAt(notes, 2.99)).toBe(2)
  })
  it('en los silencios y fuera de la canción no hay nota', () => {
    expect(noteAt(notes, 1.7)).toBe(-1)
    expect(noteAt(notes, -1)).toBe(-1)
    expect(noteAt(notes, 5)).toBe(-1)
    expect(noteAt([], 1)).toBe(-1)
  })
})
