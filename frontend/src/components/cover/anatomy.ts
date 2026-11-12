// Qué función de la app cuelga de cada parte del instrumento en la portada.
// x, y: punto de la pieza en las coordenadas del dibujo (GuitarArt / PianoArt).
export interface Part { path: string; part: string; hint: string; x: number; y: number; side: 'L' | 'R' }

export const GUITAR_PARTS: Part[] = [
  { path: '/oido', part: 'Clavijero', hint: 'Donde se afina: entrena el oído', x: 184, y: 52, side: 'R' },
  { path: '/lectura', part: 'Cejuela', hint: 'El principio de todo: leer', x: 150, y: 98, side: 'L' },
  { path: '/analizador', part: 'Cejilla', hint: '¿En qué tono está? Analiza y transporta', x: 174, y: 137, side: 'R' },
  { path: '/acordes', part: 'Diapasón', hint: 'Todos los acordes y cómo se pisan', x: 150, y: 215, side: 'L' },
  { path: '/escalas', part: 'Trastes', hint: 'Escalas y simetrías por el mástil', x: 152, y: 292, side: 'R' },
  { path: '/negativa', part: 'Aros', hint: 'El otro lado: la armonía en espejo', x: 64, y: 386, side: 'L' },
  { path: '/rearmonizar', part: 'Roseta', hint: 'El adorno: cambia el color de un acorde', x: 192, y: 409, side: 'R' },
  { path: '/pistas', part: 'Boca', hint: 'Lo que suena dentro de una canción', x: 136, y: 424, side: 'L' },
  { path: '/flamenco', part: 'Golpeador', hint: 'Rasgueo, golpe y compás', x: 210, y: 456, side: 'R' },
  { path: '/biblioteca', part: 'Etiqueta', hint: 'Tus transcripciones, guardadas dentro', x: 150, y: 447, side: 'L' },
  { path: '/laboratorio', part: 'Cuerdas', hint: 'Toca y entiende cada acorde', x: 168, y: 500, side: 'R' },
  { path: '/bach', part: 'Bordones', hint: 'Las voces graves de los corales de Bach', x: 128, y: 508, side: 'L' },
  { path: '/puentes', part: 'Puente', hint: 'De una tonalidad a otra', x: 190, y: 549, side: 'R' },
  { path: '/ritmo', part: 'Caja', hint: 'Compás, palos y palmas', x: 62, y: 566, side: 'L' },
  { path: '/asistente', part: 'Tapa', hint: 'Pregunta lo que quieras de música', x: 222, y: 596, side: 'R' },
]

export const PIANO_PARTS: Part[] = [
  { path: '/negativa', part: 'Tapa', hint: 'Lacada como un espejo: armonía negativa', x: 34, y: 78, side: 'L' },
  { path: '/puentes', part: 'Puente', hint: 'De una tonalidad a otra', x: 196, y: 190, side: 'R' },
  { path: '/escalas', part: 'Cuerdas', hint: 'Escalas, modos y simetrías', x: 96, y: 210, side: 'L' },
  { path: '/analizador', part: 'Arpa', hint: 'La estructura: analiza una progresión', x: 270, y: 316, side: 'R' },
  { path: '/pistas', part: 'Tabla armónica', hint: 'Lo que suena dentro de una canción', x: 130, y: 350, side: 'L' },
  { path: '/oido', part: 'Clavijas', hint: 'Donde se afina: entrena el oído', x: 292, y: 453, side: 'R' },
  { path: '/acordes', part: 'Macillos', hint: 'Qué notas golpea cada acorde', x: 62, y: 472, side: 'L' },
  { path: '/bach', part: 'Partitura', hint: 'Corales de Bach, acorde a acorde', x: 205, y: 496, side: 'R' },
  { path: '/ritmo', part: 'Metrónomo', hint: 'Compás, palos y palmas', x: 82, y: 498, side: 'L' },
  { path: '/lectura', part: 'Atril', hint: 'Lee partituras sin pensar', x: 256, y: 502, side: 'R' },
  { path: '/laboratorio', part: 'Teclado', hint: 'Toca y entiende cada acorde', x: 110, y: 560, side: 'L' },
  { path: '/rearmonizar', part: 'Pedales', hint: 'Sostén y color: cambia un acorde por otro', x: 196, y: 612, side: 'R' },
  { path: '/biblioteca', part: 'Cajón de la banqueta', hint: 'Tus transcripciones, guardadas', x: 128, y: 676, side: 'L' },
  { path: '/asistente', part: 'Banqueta', hint: 'El profesor, sentado a tu lado', x: 232, y: 660, side: 'R' },
]

export const STAGE = { w: 1200, h: 740 }

/**
 * Reparte las etiquetas de un lado en vertical, en el mismo orden que sus piezas, para
 * que las líneas no se crucen y ningún rótulo pise a otro.
 */
export function labelRows(parts: Part[], side: 'L' | 'R'): { part: Part; y: number }[] {
  const mine = parts.filter((p) => p.side === side).sort((a, b) => a.y - b.y)
  const top = 46
  const step = mine.length > 1 ? (STAGE.h - top * 2) / (mine.length - 1) : 0
  return mine.map((part, i) => ({ part, y: top + i * step }))
}
