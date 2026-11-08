import { describe, expect, it } from 'vitest'
import { INTERVALS, CHORD_QUALITIES, DEGREES, matchesShape, pickWeighted } from '../ear'
import { notesToMidi, progressionToMidi } from '../midifile'
import { eventsToNotes, groupChords } from '../takes'
import { evaluateTake, patternSteps } from '../tutor'
import { keyPc } from '../music'

const ev = (type: 'on' | 'off', note: number, time: number) => ({ type, note, velocity: 0.8, time, source: 'midi' as const })

describe('ear: respuestas tocadas en el MIDI', () => {
  const third = INTERVALS.find((i) => i.id === '3M')!
  const minor = CHORD_QUALITIES.find((i) => i.id === 'min')!
  it('reconoce un intervalo tocado en cualquier octava', () => {
    expect(matchesShape([60, 64], third, 'interval', 0)).toBe(true)
    expect(matchesShape([62, 66], third, 'interval', 0)).toBe(true)
    expect(matchesShape([60, 63], third, 'interval', 0)).toBe(false)
  })
  it('acepta un tipo de acorde con cualquier fundamental e inversión', () => {
    expect(matchesShape([57, 60, 64], minor, 'chord', 0)).toBe(true) // La menor
    expect(matchesShape([60, 64, 69], minor, 'chord', 0)).toBe(true) // La menor en 1ª inversión
    expect(matchesShape([60, 64, 67], minor, 'chord', 0)).toBe(false)
  })
  it('los grados se comprueban en la tonalidad de la pregunta', () => {
    const V = DEGREES.find((d) => d.id === 'V')!
    expect(matchesShape([67, 71, 74], V, 'degree', 0)).toBe(true) // Sol mayor en Do
    expect(matchesShape([67, 71, 74], V, 'degree', 2)).toBe(false)
  })
  it('la repetición adaptativa nunca repite el mismo elemento seguido', () => {
    for (let k = 0; k < 200; k++) expect(pickWeighted(INTERVALS.slice(0, 3), {}, '2m').id).not.toBe('2m')
  })
})

describe('tomas grabadas', () => {
  it('convierte eventos en notas con duración', () => {
    const notes = eventsToNotes([ev('on', 60, 1000), ev('on', 64, 1010), ev('off', 60, 1500), ev('off', 64, 1600)])
    expect(notes).toEqual([
      { note: 60, start: 0, end: 500, velocity: 0.8 },
      { note: 64, start: 10, end: 600, velocity: 0.8 },
    ])
  })
  it('agrupa en acordes las notas que entran casi a la vez', () => {
    const take = [60, 64, 67].map((n, i) => ({ note: n, start: i * 20, end: 400, velocity: 1 }))
      .concat([65, 69, 72].map((n, i) => ({ note: n, start: 600 + i * 15, end: 900, velocity: 1 })))
    expect(groupChords(take)).toEqual([[60, 64, 67], [65, 69, 72]])
  })
})

describe('tutor de acordes', () => {
  const lh = [48, 55], rh = [60, 64, 67]
  it('patrones de arpegio', () => {
    expect(patternSteps(lh, rh, 'subir')).toEqual([[48], [55], [60], [64], [67]])
    expect(patternSteps(lh, rh, 'bajar')[0]).toEqual([67])
    expect(patternSteps(lh, rh, 'subir-bajar')).toHaveLength(9)
    expect(patternSteps(lh, rh, 'alberti')[0]).toEqual([48, 55, 60])
    expect(patternSteps(lh, rh, 'bloque')).toEqual([[48, 55, 60, 64, 67]])
  })
  it('evalúa un bloque bien tocado y uno con fallos', () => {
    const steps = patternSteps(lh, rh, 'bloque')
    const good = [48, 55, 60, 64, 67].map((n, i) => ({ note: n, start: i * 5, end: 800, velocity: 0.8 }))
    const r = evaluateTake(good, steps, 'bloque')
    expect(r.missing).toEqual([])
    expect(r.score).toBe(100)
    const bad = evaluateTake(good.slice(0, 4).concat({ note: 66, start: 300, end: 800, velocity: 0.8 }), steps, 'bloque')
    expect(bad.missing).toEqual([67])
    expect(bad.extra).toEqual([66])
    expect(bad.score).toBeLessThan(70)
  })
  it('en arpegio comprueba el orden', () => {
    const steps = patternSteps(lh, rh, 'subir')
    const inOrder = [48, 55, 60, 64, 67].map((n, i) => ({ note: n, start: i * 250, end: i * 250 + 200, velocity: 0.8 }))
    expect(evaluateTake(inOrder, steps, 'subir').orderOk).toBe(true)
    expect(evaluateTake([...inOrder].reverse().map((n, i) => ({ ...n, start: i * 250 })), steps, 'subir').orderOk).toBe(false)
  })
})

describe('ficheros MIDI', () => {
  it('cabecera estándar y pista bien formada', () => {
    const bytes = progressionToMidi([[60, 64, 67]], 120, 4)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd')
    expect(String.fromCharCode(...bytes.slice(14, 18))).toBe('MTrk')
    const len = (bytes[18] << 24) | (bytes[19] << 16) | (bytes[20] << 8) | bytes[21]
    expect(len).toBe(bytes.length - 22)
    expect([...bytes.slice(-4)]).toEqual([0, 0xff, 0x2f, 0x00]) // fin de pista
  })
  it('una toma conserva sus tiempos (delta en longitud variable)', () => {
    const bytes = notesToMidi([{ note: 60, start: 0, end: 1000, velocity: 1 }], 120)
    // 1000 ms a 120 bpm = 2 negras = 960 ticks → VLQ 0x87 0x40
    const s = [...bytes]
    const i = s.findIndex((b, k) => b === 0x80 && s[k + 1] === 60)
    expect(s.slice(i - 2, i)).toEqual([0x87, 0x40])
  })
})

describe('utilidades', () => {
  it('keyPc', () => {
    expect([keyPc('C'), keyPc('Eb'), keyPc('F#m'), keyPc('Bbm')]).toEqual([0, 3, 6, 10])
  })
})
