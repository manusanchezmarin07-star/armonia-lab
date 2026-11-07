import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow'

const NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b']

/** Convierte MIDI a clave VexFlow ('c#/4'); si llega el nombre deletreado se respeta. */
function toKey(m: number, spelled?: string) {
  const oct = Math.floor(m / 12) - 1
  if (spelled) {
    const letter = spelled[0].toLowerCase()
    const acc = spelled.slice(1).replace('♭', 'b').replace('♯', '#')
    // Corrige la octava en enarmonías que cruzan el Do (B#3 = C4, Cb4 = B3).
    let o = oct
    if (letter === 'b' && m % 12 === 0) o -= 1
    if (letter === 'c' && m % 12 === 11) o += 1
    return { key: `${letter}${acc}/${o}`, acc }
  }
  const n = NAMES[m % 12]
  return { key: `${n}/${oct}`, acc: n.slice(1) }
}

/**
 * Pentagrama doble (clave de sol + fa) con un acorde: las notas >= Do4 van arriba.
 * `spell` permite pasar el nombre correcto de cada pitch class (Eb en vez de D#).
 */
export default function Staff({ notes, spell = {}, width = 300 }: { notes: number[]; spell?: Record<number, string>; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = ''
    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(width, 230)
    const ctx = renderer.getContext()
    ctx.setFillStyle('#e9e4da')
    ctx.setStrokeStyle('#e9e4da')
    const treble = new Stave(10, 0, width - 20).addClef('treble').setContext(ctx).draw()
    const bass = new Stave(10, 110, width - 20).addClef('bass').setContext(ctx).draw()
    new StaveConnector(treble, bass).setType('brace').setContext(ctx).draw()
    new StaveConnector(treble, bass).setType('singleLeft').setContext(ctx).draw()
    const sorted = [...notes].sort((a, b) => a - b)
    const hi = sorted.filter((m) => m >= 60)
    const lo = sorted.filter((m) => m < 60)
    const mk = (list: number[], clef: string) => {
      if (!list.length) return new StaveNote({ keys: [clef === 'treble' ? 'b/4' : 'd/3'], duration: 'wr', clef })
      const ks = list.map((m) => toKey(m, spell[m % 12]))
      const n = new StaveNote({ keys: ks.map((k) => k.key), duration: 'w', clef })
      ks.forEach((k, i) => { if (k.acc) n.addModifier(new Accidental(k.acc), i) })
      return n
    }
    const draw = (stave: Stave, list: number[], clef: string) => {
      const v = new Voice({ num_beats: 4, beat_value: 4 }).addTickables([mk(list, clef)])
      new Formatter().joinVoices([v]).format([v], width - 90)
      v.draw(ctx, stave)
    }
    draw(treble, hi, 'treble')
    draw(bass, lo, 'bass')
  }, [notes, spell, width])
  return <div ref={ref} className="staff" style={{ filter: 'drop-shadow(0 0 0 transparent)' }} />
}
