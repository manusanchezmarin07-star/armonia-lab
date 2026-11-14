import { lazy, type ComponentType } from 'react'
import * as I from './components/Icons'
const Lab = lazy(() => import('./pages/Lab'))
const Bridges = lazy(() => import('./pages/Bridges'))
const Reharm = lazy(() => import('./pages/Reharm'))
const Scales = lazy(() => import('./pages/Scales'))
const Negative = lazy(() => import('./pages/Negative'))
const Analyzer = lazy(() => import('./pages/Analyzer'))
const Rhythm = lazy(() => import('./pages/Rhythm'))
const Library = lazy(() => import('./pages/Library'))
const Stems = lazy(() => import('./pages/Stems'))
const Bach = lazy(() => import('./pages/Bach'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Ear = lazy(() => import('./pages/Ear'))
const Reading = lazy(() => import('./pages/Reading'))
const Flamenco = lazy(() => import('./pages/Flamenco'))
const Chords = lazy(() => import('./pages/Chords'))

export interface Module {
  path: string
  label: string
  icon: ComponentType
  element: ComponentType
  section: string
  /** Frase corta para la pantalla de inicio. */
  blurb: string
  /** Pantalla propia de un instrumento: en el otro modo no aparece en los menús. */
  only?: 'piano' | 'guitarra'
}

// Cada pantalla se carga bajo demanda (React.lazy): la primera visita es mucho más
// ligera y librerías pesadas como la de partituras (OSMD) solo se descargan en Bach.
// Registro único de pantallas: el menú lateral y la pantalla de inicio se generan
// a partir de esta lista, así añadir un módulo es tocar un solo sitio.
export const MODULES: Module[] = [
  { section: 'Armonía', path: '/laboratorio', label: 'Laboratorio', icon: I.IconLab, element: Lab, blurb: 'Toca un acorde y descubre qué es y qué función tiene.' },
  { section: 'Armonía', path: '/acordes', label: 'Diccionario de acordes', icon: I.IconBook, element: Chords, blurb: 'Todos los acordes, con un tutor para aprender a tocar cada uno.' },
  { section: 'Armonía', path: '/puentes', label: 'Puentes y modulaciones', icon: I.IconBridge, element: Bridges, blurb: 'Siete caminos para cambiar de tonalidad, del más suave al más brusco.' },
  { section: 'Armonía', path: '/rearmonizar', label: 'Rearmonizar', icon: I.IconSpark, element: Reharm, blurb: 'Sustitutos para cualquier acorde o nota de la melodía, al estilo Collier.' },
  { section: 'Armonía', path: '/escalas', label: 'Escalas y simetría', icon: I.IconScale, element: Scales, blurb: 'Modos, escalas simétricas y Messiaen en el reloj de 12 notas.' },
  { section: 'Armonía', path: '/negativa', label: 'Armonía negativa', icon: I.IconMirror, element: Negative, blurb: 'Refleja progresiones sobre el eje de la tónica.' },
  { section: 'Armonía', path: '/analizador', label: 'Analizador', icon: I.IconAnalyze, element: Analyzer, blurb: 'Grados, funciones y modulaciones de cualquier progresión.' },
  { section: 'Ritmo', path: '/ritmo', label: 'Compás y palos', icon: I.IconRhythm, element: Rhythm, blurb: 'Soleá, bulería, seguiriya y amalgamas con palmas.' },
  { section: 'Ritmo', path: '/flamenco', label: 'Guitarra flamenca', icon: I.IconGuitar, element: Flamenco, only: 'guitarra', blurb: 'Rasgueos, compás con golpe, tablatura y cadencia andaluza por arriba y por medio.' },
  { section: 'Entrenamiento', path: '/oido', label: 'Oído', icon: I.IconEar, element: Ear, blurb: 'Intervalos, acordes, grados y progresiones, respondiendo con tu MIDI.' },
  { section: 'Entrenamiento', path: '/lectura', label: 'Lectura', icon: I.IconScore, element: Reading, blurb: 'Lee notas, acordes y armaduras y tócalos en tu instrumento.' },
  { section: 'Estudio', path: '/pistas', label: 'Pistas y acordes', icon: I.IconStems, element: Stems, blurb: 'Separa una canción en instrumentos y saca sus acordes.' },
  { section: 'Estudio', path: '/bach', label: 'Corales de Bach', icon: I.IconBach, element: Bach, blurb: 'Partituras reales analizadas acorde a acorde.' },
  { section: 'Estudio', path: '/biblioteca', label: 'Mi biblioteca', icon: I.IconBook, element: Library, blurb: 'Tus transcripciones por artista.' },
  { section: 'Estudio', path: '/asistente', label: 'Asistente', icon: I.IconChat, element: Assistant, blurb: 'Pregunta lo que quieras de música (y solo de música).' },
]

/** Pantallas que tienen sentido con el instrumento elegido (las del otro no se ofrecen en los menús). */
export const modulesFor = (instrument: 'piano' | 'guitarra') => MODULES.filter((m) => !m.only || m.only === instrument)
