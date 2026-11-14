// Contenido de los tours guiados. Cada paso apunta a un elemento marcado con
// data-tour="…" en su pantalla; si el elemento no está visible (p. ej. en móvil),
// el cuadro se muestra centrado.

export interface TourStep {
  route: string
  target?: string // valor de data-tour
  title: string
  text: string
  /** Solo aparece en el tour de esa pantalla (no en el general). */
  detail?: boolean
  /** Solo aparece en el tour general (no en el de esa pantalla). */
  onlyGeneral?: boolean
  /** Título y texto en modo guitarra, cuando el paso habla del teclado o de las dos manos. */
  guitar?: { title?: string; text?: string }
}

export const TOUR_STEPS: TourStep[] = [
  { route: '/', title: 'Bienvenido a Armonía Lab', text: 'Te enseño en un par de minutos qué puedes hacer aquí. Puedes avanzar con los botones o con las flechas ← → del teclado, y salir cuando quieras con Esc.' },
  { route: '/', target: 'cover-instruments', title: 'Elige tu instrumento', text: 'Piano o guitarra. Al pulsar uno se amplía y cada función de la app aparece colgada de una de sus partes: el puente lleva a «Puentes y modulaciones», el atril a «Lectura»… La app entera (sonido, acordes y tutores) se adapta al que elijas.' },
  { route: '/laboratorio', target: 'sidebar', onlyGeneral: true, title: 'El menú', text: 'Dentro de cada pantalla tienes todas las herramientas a la izquierda, agrupadas en Armonía, Ritmo, Entrenamiento y Estudio, y el interruptor de piano o guitarra. Con Ctrl+K saltas a cualquiera escribiendo su nombre.' },

  { route: '/laboratorio', target: 'lab-piano', title: 'Laboratorio: toca', text: 'Toca en tu teclado MIDI, con el ratón o con el teclado del ordenador (fila A S D F… = teclas blancas; W E T Y U = negras; Z/X cambian de octava).', guitar: { text: 'Monta un acorde en el mástil haciendo clic en sus casillas (una por cuerda) y pulsa «Rasguear», o tócalo en un teclado MIDI si tienes uno conectado.' } },
  { route: '/laboratorio', target: 'lab-chord', title: '…y entiende lo que tocas', text: 'Aquí aparece el nombre del acorde, sus notas, el pentagrama, su función en la tonalidad y las escalas para improvisar encima. El botón «Cómo se toca» abre el tutor con dedos para las dos manos.', guitar: { text: 'Aquí aparece el nombre del acorde, sus notas, el pentagrama de guitarra, su función en la tonalidad y las escalas para improvisar encima. Junto al nombre va su posición en el mástil; «Cómo se toca» abre el tutor con dedos, rasgueos y arpegios.' } },
  { route: '/laboratorio', target: 'lab-key', title: 'Tonalidad de referencia', text: 'Elige la tonalidad para que te diga el grado (I, V7/IV, bVII…) y la función de cada acorde.', detail: true },
  { route: '/laboratorio', target: 'lab-transition', title: 'Conectar dos acordes', text: 'Guarda un acorde como A y otro como B: te explico por qué uno lleva al otro y cómo moverte con el menor movimiento de dedos.', detail: true },

  { route: '/laboratorio', target: 'lab-recorder', title: 'Grabadora', text: 'Graba lo que tocas, escúchalo, expórtalo a MIDI o pulsa «Sacar acordes» para convertir tu toma en una progresión que puedes analizar.', detail: true },
  { route: '/acordes', target: 'dict-controls', title: 'Diccionario de acordes', text: 'Elige una nota y un nivel, o busca por cifrado (Bb13) o por nombre (semidisminuido). Cada tarjeta enseña la fórmula y el acorde en el teclado; «Enséñame» abre el tutor de piano.', detail: true, guitar: { text: 'Elige una nota y un nivel, o busca por cifrado (Bb13) o por nombre (semidisminuido). Cada tarjeta enseña la fórmula y el diagrama del acorde; «Enséñame» abre el tutor de guitarra.' } },
  { route: '/puentes', target: 'bridges-circle', title: 'Puentes: el círculo de quintas', text: 'Clic en una tonalidad = destino; Mayús+clic = origen. Cuanto más lejos en el círculo, más brusco es el cambio.' },
  { route: '/puentes', target: 'bridges-routes', title: 'Siete caminos', text: 'Pivote, ii–V–I, bisagra disminuida, sustituto tritonal… ordenados de más suave a más brusco según cuánto se mueven las voces.' },
  { route: '/puentes', target: 'bridges-detail', title: 'Míralo en el teclado', text: 'Pulsa Reproducir: en turquesa las notas que se mantienen (las que disimulan el cambio) y en coral las que se mueven.', detail: true, guitar: { title: 'Míralo en el mástil', text: 'Pulsa Reproducir: cada acorde del camino se dibuja con su posición de guitarra; en turquesa las notas que se mantienen y en coral las que se mueven.' } },

  { route: '/rearmonizar', target: 'reharm-tabs', title: 'Rearmonizar', text: 'Tres modos: sustituir un acorde, armonizar una nota de la melodía o rearmonizar una progresión entera (jazz, Collier/negativa, góspel).' },
  { route: '/rearmonizar', target: 'reharm-form', title: 'Busca sustitutos', text: 'Escribe el acorde y hacia dónde va. Opcionalmente, la nota de la melodía, para saber si encaja en cada sustituto.', detail: true },
  { route: '/rearmonizar', target: 'reharm-cards', title: 'Cada sustituto, explicado', text: 'Con la regla que lo justifica, lo suave que es y el botón «Cómo se toca»: notas y dedos de cada mano, arpegios, modo espera y grabación de tu toma.' },

  { route: '/escalas', target: 'scales-list', title: 'Escalas y simetría', text: 'Modos, menor melódica, frigio dominante, pentatónicas y escalas simétricas (tonos enteros, disminuida, Messiaen).', detail: true },
  { route: '/escalas', target: 'scales-circle', title: 'El reloj de 12 notas', text: 'Las escalas simétricas forman figuras regulares: por eso sirven de puente entre varias tonalidades a la vez.' },

  { route: '/negativa', target: 'negative-form', title: 'Armonía negativa', text: 'Escribe una progresión y la tónica: se refleja nota a nota sobre el eje. G7 se convierte en Fm6, el sello de Jacob Collier.' },

  { route: '/analizador', target: 'analyzer-input', title: 'Analizador', text: 'Pega los acordes de una canción: grados, funciones, préstamos y modulaciones. Puedes transportarla a cualquier tonalidad.' },
  { route: '/analizador', target: 'analyzer-practice', title: 'Practicar', text: 'Toca la progresión en bucle con metrónomo, al tempo que quieras, y expórtala a MIDI.', detail: true },

  { route: '/ritmo', target: 'rhythm-clock', title: 'Compás y palos', text: 'El ciclo como un reloj: los círculos grandes son los acentos. Pulsa cualquier tiempo para crear tus propias amalgamas.' },
  { route: '/oido', target: 'ear-modes', title: 'Entrena el oído', text: 'Intervalos, tipos de acorde, grados y progresiones. Responde tocando en el MIDI: lo que más fallas, más te sale.' },
  { route: '/lectura', target: 'read-levels', title: 'Aprende a leer', text: 'Seis niveles, de la clave de Sol a las armaduras. Aparece una nota y la tocas en el piano.', guitar: { text: 'Niveles por cuerdas y posiciones, de las tres primeras cuerdas a las notas agudas. Aparece una nota y la tocas en el mástil (la guitarra se escribe una octava más alta de lo que suena).' } },
  { route: '/pistas', target: 'stems-upload', title: 'Modo canción', text: 'Sube un audio: se separa en voz, bajo, piano, batería… y se sacan los acordes (con alternativas para corregir). Después: letra con los acordes encima y un tutorial de piano tipo vídeo con las dos manos.', guitar: { text: 'Sube un audio o pega un enlace de YouTube: se separa en voz, bajo, guitarra, batería… y se sacan los acordes y la melodía. Después tienes la letra con los acordes encima y un tutorial de guitarra con diagramas, cejilla recomendada y modo espera.' } },
  { route: '/bach', target: 'bach-list', title: 'Corales de Bach', text: 'Partituras reales analizadas acorde a acorde, con cada voz silenciable.', detail: true },
  { route: '/asistente', target: 'assistant-input', title: 'Pregunta', text: 'Un profesor local que solo habla de música. Los acordes los calcula el motor de teoría, así que no se los inventa.' },
  { route: '/', target: 'midi-button', title: 'Tu teclado MIDI', text: 'Aquí ajustas el teclado: transporte (tocar en Do y que suene en Sol), volumen con el fader, vibrato con la rueda de modulación y botones asignables con «Aprender». Incluye un monitor para ver qué envía cada botón.' },
  { route: '/', title: '¡Listo!', text: 'Ya conoces la app. En cada pantalla tienes el botón «?» abajo a la derecha para repetir su tour cuando quieras.' },
]

/** Tour general (sin pasos de detalle) o el de una pantalla concreta, con los textos del instrumento elegido. */
export function stepsFor(scope: 'general' | string, guitar = false): TourStep[] {
  const steps = scope === 'general' ? TOUR_STEPS.filter((s) => !s.detail) : TOUR_STEPS.filter((s) => s.route === scope && s.target && !s.onlyGeneral)
  return guitar ? steps.map((s) => ({ ...s, ...s.guitar })) : steps
}
