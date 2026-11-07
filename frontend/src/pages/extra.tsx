import type { ComponentType } from 'react'
import { IconBach, IconChat, IconStems } from '../components/Icons'
import Assistant from './Assistant'
import Bach from './Bach'
import Stems from './Stems'

// Módulos del sprint 2 (Bach, pistas, asistente). Se registran aquí para que el
// menú y las rutas se generen solos al añadirlos.
export const EXTRA_ROUTES: { path: string; label: string; icon: ComponentType; element: ComponentType }[] = [
  { path: '/pistas', label: 'Pistas y acordes', icon: IconStems, element: Stems },
  { path: '/bach', label: 'Corales de Bach', icon: IconBach, element: Bach },
  { path: '/asistente', label: 'Asistente', icon: IconChat, element: Assistant },
]
