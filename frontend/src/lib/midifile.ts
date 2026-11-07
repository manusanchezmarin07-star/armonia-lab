// Escritor mínimo de ficheros MIDI estándar (SMF tipo 0) para exportar progresiones
// y abrirlas en un DAW, MuseScore o el propio piano.

const TPQ = 480 // ticks por negra

function vlq(n: number): number[] {
  // Cantidad de longitud variable: 7 bits por byte, el bit alto indica "sigue".
  const out = [n & 0x7f]
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80)
  return out
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]

/** Convierte acordes (notas MIDI) en un fichero .mid: cada acorde dura `beats` negras. */
export function progressionToMidi(chords: number[][], bpm = 90, beats = 4, velocity = 80): Uint8Array {
  const ev: number[] = []
  const tempo = Math.round(60_000_000 / bpm)
  ev.push(0, 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff)
  ev.push(0, 0xff, 0x58, 0x04, 4, 2, 24, 8) // compás 4/4
  const dur = beats * TPQ
  for (const chord of chords) {
    chord.forEach((n) => ev.push(0, 0x90, n, velocity))
    chord.forEach((n, i) => ev.push(...vlq(i === 0 ? dur : 0), 0x80, n, 0))
  }
  ev.push(0, 0xff, 0x2f, 0x00)
  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), ...u16(0), ...u16(1), ...u16(TPQ)]
  const track = [0x4d, 0x54, 0x72, 0x6b, ...u32(ev.length), ...ev]
  return new Uint8Array([...header, ...track])
}

export function downloadMidi(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name.replace(/[^\w\- áéíóúñ]+/gi, '_') + '.mid'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
