import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'

export interface ReadNote { letter: string; alter: number; octave: number }

const ACC: Record<number, string> = { [-1]: 'b', 0: '', 1: '#' }
export const vfKey = (n: ReadNote) => `${n.letter.toLowerCase()}${ACC[n.alter]}/${n.octave}`

interface Props {
  clef: 'treble' | 'bass'
  notes?: ReadNote[] // una nota o un acorde
  keySig?: string // armadura (p. ej. 'Eb', 'F#')
  color?: string
  width?: number
  /** Clave de Sol con un 8 debajo: la guitarra suena una octava más grave de lo escrito. */
  octaveDown?: boolean
}

/** Pentagrama simple y grande para leer: una clave, una nota/acorde o una armadura. */
export default function ReadStaff({ clef, notes = [], keySig, color = '#f1ece3', width = 340, octaveDown }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = ''
    const r = new Renderer(el, Renderer.Backends.SVG)
    r.resize(width, 170)
    const ctx = r.getContext()
    ctx.scale(1.4, 1.4)
    ctx.setFillStyle(color)
    ctx.setStrokeStyle(color)
    const stave = new Stave(6, 10, width / 1.4 - 14).addClef(clef, 'default', octaveDown ? '8vb' : undefined)
    if (keySig) stave.addKeySignature(keySig)
    stave.setContext(ctx).draw()
    if (!notes.length) return
    const n = new StaveNote({ keys: notes.map(vfKey), duration: 'w', clef })
    notes.forEach((x, i) => { if (x.alter) n.addModifier(new Accidental(ACC[x.alter]), i) })
    n.setStyle({ fillStyle: color, strokeStyle: color })
    const v = new Voice({ num_beats: 4, beat_value: 4 }).addTickables([n])
    new Formatter().joinVoices([v]).format([v], 80)
    v.draw(ctx, stave)
  }, [clef, JSON.stringify(notes), keySig, color, width, octaveDown])
  return <div ref={ref} className="read-staff" />
}
