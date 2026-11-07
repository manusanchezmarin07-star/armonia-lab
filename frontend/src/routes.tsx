import type { ComponentType } from 'react'
import * as I from './components/Icons'
import Lab from './pages/Lab'
import Bridges from './pages/Bridges'
import Reharm from './pages/Reharm'
import Scales from './pages/Scales'
import Negative from './pages/Negative'
import Analyzer from './pages/Analyzer'
import Rhythm from './pages/Rhythm'
import Library from './pages/Library'
import Stems from './pages/Stems'
import Bach from './pages/Bach'
import Assistant from './pages/Assistant'
import Ear from './pages/Ear'
import Reading from './pages/Reading'

export interface Module {
  path: string
  label: string
  icon: ComponentType
  element: ComponentType
  section: string
  /** Frase corta para la pantalla de inicio. */
  blurb: string
}

// Registro único de pantallas: el menú lateral y la pantalla de inicio se generan
// a partir de esta lista, así añadir un módulo es tocar un solo sitio.
export const MODULES: Module[] = [
  { section: 'Armonía', path: '/laboratorio', label: 'Laboratorio', icon: I.IconLab, element: Lab, blurb: 'Toca un acorde y descubre qué es y qué función tiene.' },
  { section: 'Armonía', path: '/puentes', label: 'Puentes y modulaciones', icon: I.IconBridge, element: Bridges, blurb: 'Siete caminos para cambiar de tonalidad, del más suave al más brusco.' },
  { section: 'Armonía', path: '/rearmonizar', label: 'Rearmonizar', icon: I.IconSpark, element: Reharm, blurb: 'Sustitutos para cualquier acorde o nota de la melodía, al estilo Collier.' },
  { section: 'Armonía', path: '/escalas', label: 'Escalas y simetría', icon: I.IconScale, element: Scales, blurb: 'Modos, escalas simétricas y Messiaen en el reloj de 12 notas.' },
  { section: 'Armonía', path: '/negativa', label: 'Armonía negativa', icon: I.IconMirror, element: Negative, blurb: 'Refleja progresiones sobre el eje de la tónica.' },
  { section: 'Armonía', path: '/analizador', label: 'Analizador', icon: I.IconAnalyze, element: Analyzer, blurb: 'Grados, funciones y modulaciones de cualquier progresión.' },
  { section: 'Ritmo', path: '/ritmo', label: 'Compás y palos', icon: I.IconRhythm, element: Rhythm, blurb: 'Soleá, bulería, seguiriya y amalgamas con palmas.' },
  { section: 'Entrenamiento', path: '/oido', label: 'Oído', icon: I.IconEar, element: Ear, blurb: 'Intervalos, acordes, grados y progresiones, respondiendo con tu MIDI.' },
  { section: 'Entrenamiento', path: '/lectura', label: 'Lectura', icon: I.IconScore, element: Reading, blurb: 'Lee notas, acordes y armaduras y tócalos en el piano.' },
  { section: 'Estudio', path: '/pistas', label: 'Pistas y acordes', icon: I.IconStems, element: Stems, blurb: 'Separa una canción en instrumentos y saca sus acordes.' },
  { section: 'Estudio', path: '/bach', label: 'Corales de Bach', icon: I.IconBach, element: Bach, blurb: 'Partituras reales analizadas acorde a acorde.' },
  { section: 'Estudio', path: '/biblioteca', label: 'Mi biblioteca', icon: I.IconBook, element: Library, blurb: 'Tus transcripciones por artista.' },
  { section: 'Estudio', path: '/asistente', label: 'Asistente', icon: I.IconChat, element: Assistant, blurb: 'Pregunta lo que quieras de música (y solo de música).' },
]
