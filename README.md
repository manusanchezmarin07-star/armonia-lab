# Armonía Lab 🎹

App gratuita y 100 % local para estudiar armonía como la estudian los grandes: entender **por qué** un cambio
de tonalidad suena suave, ver las notas que se mantienen y las que se mueven, reflejar progresiones en
**armonía negativa**, explorar modos y **escalas simétricas**, y practicar **compás flamenco** y amalgamas.
Funciona con tu teclado MIDI (Alesis Q49, piano digital por USB), con el ratón o con el teclado del ordenador.

## Instalación (Windows 11)

1. Descarga o clona el repositorio.
2. Doble clic en **`INSTALAR.bat`**. Instala lo que falte (uv + Python 3.12, Node.js), las dependencias,
   PyTorch con CUDA para tu RTX, el piano de cola Salamander y el modelo de Ollama. La primera vez tarda un rato.
   - `INSTALAR.bat -SinPistas` si no quieres la separación de pistas (ahorra ~3 GB).
   - `INSTALAR.bat -SinIA` si no quieres descargar el modelo del asistente.
3. Abre **Armonía Lab** desde el escritorio (o `ARRANCAR.bat`). Se abre en el navegador: usa **Chrome o Edge**,
   que son los que soportan MIDI.

## Módulos

| Módulo | Qué hace |
|---|---|
| **Laboratorio** | Tocas y te dice el acorde (incluidos voicings densos tipo `Cmaj9(#11)`), su inversión, sus notas, su grado y función en la tonalidad, y cómo conecta con otro acorde. |
| **Puentes y modulaciones** | De una tonalidad a otra por 7 caminos (pivote, ii–V–I, bisagra disminuida, sustituto tritonal, cadena de dominantes, dominante negativa, nota común), ordenados por suavidad, con conducción de voces animada. |
| **Escalas y simetría** | Modos de la mayor y de la menor melódica, menor armónica, frigio dominante, pentatónicas, tonos enteros, disminuida, aumentada y los 7 modos de Messiaen, con el reloj de 12 notas que revela la simetría. |
| **Armonía negativa** | Refleja cualquier progresión sobre el eje de la tónica, en espejo nota a nota, y explica por qué conserva la función. |
| **Rearmonizar** | Sustitutos para cualquier acorde (tritono, backdoor, negativa, disminuidos, mediantes, preparaciones) ordenados por suavidad, todos los acordes posibles bajo una nota de la melodía y estilos de rearmonización (jazz, Collier/negativa, góspel). |
| **Tutor de acordes** | En Rearmonizar y en el Laboratorio, botón «🎹 Cómo se toca»: notas de cada mano con **digitación sugerida** en el teclado y en el pentagrama, inversiones y estilos (básico, jazz, abierto), paso a paso con **modo espera**, 6 patrones de **arpegio**, y **grabación** de tu toma con evaluación (notas, simultaneidad, orden, regularidad) y exportación a MIDI. |
| **Analizador** | Grados romanos, funciones, dominantes secundarias, sustitutos tritonales, préstamos modales y detección de modulaciones. Transporta a cualquier tonalidad con deletreo correcto, practica en bucle con metrónomo y exporta a `.mid`. |
| **Compás y palos** | Soleá, alegrías, bulería, seguiriya, tangos, sevillanas y compases de amalgama, en reloj y en línea, con metrónomo de palmas. |
| **Oído** | Intervalos, tipos de acorde, grados con cadencia y progresiones. Respondes con botones, números o **tocando en el MIDI**; lo que más fallas sale más. |
| **Lectura** | Entrenador de lectura por niveles: clave de Sol, de Fa, líneas adicionales, alteraciones, tríadas y armaduras. Tocas la nota que ves. |
| **Mi biblioteca** | Tus transcripciones por artista (Jacob Collier, Bach, Vicente Marín Trío, Emily Bear...). Se guardan en `data/`. |
| **Pistas y acordes (modo canción)** | 1) Demucs separa voz, bajo, piano, guitarra y batería; el **mezclador se adapta a la canción** (oculta pistas vacías y nombra cada una por lo que suena: «Cuerdas frotadas: violín, chelo»…); los acordes se detectan combinando el cromagrama con el modelo de notas de basic-pitch y se muestran en una **tabla por compases** (con alternativas para corregir con un clic o tocando en el MIDI). 2) **Letra y acordes**: transcripción de la voz con Whisper o letra pegada alineada con la voz; cada acorde encima de su palabra, karaoke y validación. 3) **Tutorial de piano** tipo vídeo: notas que caen con el número de dedo, las dos manos en el teclado, acorde siguiente, letra y modo espera. |
| **Corales de Bach** | Los corales del corpus de music21 con su partitura, voces silenciables y análisis acorde a acorde (con music21 como segunda opinión). |
| **Asistente** | Profesor local con Ollama (Qwen 2.5 7B por defecto) que **solo habla de música**. Las notas y acordes los calcula el motor de teoría y las explicaciones salen de `backend/knowledge` con fuentes citadas. Sin Ollama funciona en modo bot. |

## Asistente local

- Necesita [Ollama](https://ollama.com) abierto. El instalador descarga `qwen2.5:7b`, que cabe en 8 GB de VRAM.
- Para usar otro modelo: variable de entorno `OLLAMA_MODEL` (por ejemplo `qwen2.5:14b` si tienes más VRAM).
- La base de conocimiento son ficheros Markdown en `backend/knowledge/`. Puedes añadir los tuyos (por ejemplo, apuntes
  sobre Vicente Marín Trío) con el mismo formato: cabecera `title` y `sources`, y secciones `## `.

## Tour guiado y ayuda

En Inicio, **▶ Tour guiado** recorre la app con cuadros que señalan cada parte. En cada pantalla, el botón **?** (abajo a la derecha) repite el tour de esa pantalla.

## Teclado MIDI y controles (🎛 en el menú)

- **Transporte**: tocas con las teclas de Do y suena (y se analiza) en la tonalidad que elijas.
- **Fader de volumen** (CC 7) y **rueda de modulación** (CC 1 → vibrato), asignados por defecto. El **pitch bend** dobla la afinación con el sonido de sintetizador; el piano de cola no la dobla, igual que un piano real.
- **Botones asignables** con «Aprender»: transponer, octava, quitar transporte o «siguiente» (en Oído y Lectura).
- **Monitor MIDI** para ver qué envía cada botón. Los botones de octava y transposición del propio Alesis actúan dentro del teclado (cambian las notas que envía), así que funcionan sin configurar nada.

## Analizar canciones de tus artistas

La app **no descarga música** de YouTube, Spotify ni otras plataformas: sus condiciones de uso no lo permiten, el streaming lleva protección anticopia y la música tiene derechos de autor. El flujo es con audio que tengas legalmente:

1. Consigue el archivo: compra la canción en una tienda que dé descarga (Bandcamp, iTunes Store, Qobuz, Amazon Music…), pásala de un CD tuyo o graba tu propia interpretación. Sirven mp3, wav, flac y m4a sin DRM.
2. **Pistas y acordes** → arrastra el archivo. Demucs separa voz, bajo, piano, guitarra y batería, y se detectan pulso, tonalidad y acordes.
   En la pestaña **Letra y acordes** pulsa «Transcribir la voz» o pega la letra que tengas; revisa y pulsa «✓ Está bien».
   En **Tutorial de piano** tócala con las dos manos (activa «Modo espera» para ir a tu ritmo).
3. Escucha cada pista aislada (solo, velocidad al 50–70 %, bucle sobre un acorde) y **corrige con tu MIDI** los acordes dudosos.
4. **Guardar progresión** → queda en Mi biblioteca con el artista.
5. Desde ahí: **Analizar** (grados y modulaciones), **Rearmonizar** y **Cómo se toca** para cada acorde.

## Atajos

| Atajo | Qué hace |
|---|---|
| `A W S E D F T G Y H U J K O L P Ñ` | Tocar notas con el teclado del ordenador |
| `Z` / `X` | Bajar / subir octava |
| `Ctrl` + `K` | Buscador rápido de pantallas |
| `Espacio`, `1`–`9` | En Oído y Lectura: siguiente / responder |
| `←` `→` `Esc` | En el tour: anterior / siguiente / salir |

## Fiabilidad

La teoría no la "adivina" una IA: está programada en `backend/app/domain` y verificada con tests automáticos que
comparan cada resultado con **music21** (librería académica del MIT). Las explicaciones de ritmo y escalas citan
sus fuentes. Hay tres capas de tests:

- **Unitarios** contrastados con music21.
- **De propiedades** (Hypothesis): invariantes musicales comprobadas sobre cientos de casos aleatorios. Por ejemplo, que
  reflejar dos veces en armonía negativa devuelva el original o que transportar conserve la forma de cada acorde.
  Encontraron dos bugs reales que ya están corregidos.
- **Bancos de pruebas del detector de acordes**: `backend/tests/chord_bench.py` (síntesis rápida) y `backend/tests/chord_bench_real.py` (instrumentos sampleados con FluidSynth). Miden el acierto con verdad conocida y hay tests que impiden que empeore.
- **Auditoría de maquetación** (e2e): ninguna pantalla puede desbordarse en móvil ni en tablet.
- **Unitarios del frontend** (Vitest): lógica del tutor, del oído, de las tomas y de los ficheros MIDI.
- **End-to-end** (Playwright): recorren la app en un navegador real, en escritorio y en móvil, con un teclado MIDI simulado.

El CI de GitHub Actions los ejecuta en cada push. En local:

```bash
.venv\Scripts\python -m pytest backend/tests
```

```bash
cd frontend && npm run e2e
```

## Arquitectura

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y el plan de sprints en [`docs/PLAN.md`](docs/PLAN.md).

## Desarrollo

```bash
cd backend && ..\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8765
```

```bash
cd frontend && npm run dev
```

Créditos de audio: Salamander Grand Piano de Alexander Holm (CC-BY 3.0).
