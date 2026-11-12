# Plan de sprints — Armonía Lab

Gitflow: `main` (estable) ← PR por sprint ← `develop` ← `feature/*` (una por tarea) · `hotfix/*` para bugs en main.

## Sprint 1 — Núcleo de estudio (MVP) ✅
- [x] feature/motor-teoria — acordes, tonalidades, funciones, armonía negativa, modulaciones, escalas simétricas, palos (tests vs music21)
- [x] feature/api — FastAPI por capas (routers → servicios → dominio)
- [x] feature/frontend-base — React+TS: diseño, teclado, audio (Tone.js), MIDI (Web MIDI: Alesis Q49 / piano)
- [x] feature/laboratorio — reconocimiento de acordes en directo + transición entre acordes
- [x] feature/puentes — rutas de modulación animadas
- [x] feature/escalas — modos y simétricas
- [x] feature/armonia-negativa
- [x] feature/analizador — análisis de progresiones + biblioteca personal
- [x] feature/ritmo — compás flamenco y amalgamas
- [x] feature/instalador-windows — install.ps1 / start.bat
- [x] PR develop → main (Sprint 1)

## Sprint 2 — Estudio de genios y pistas ✅
- [x] feature/bach — corales de Bach (corpus music21) con análisis
- [x] feature/pistas — separación Demucs (GPU) + acordes por tiempo + corrección por MIDI
- [x] feature/asistente — asistente local (Ollama/Qwen) solo de música, con base de conocimiento local y modo bot sin IA
- [x] PR develop → main (Sprint 2)

## Pendiente de validar en el PC de Manu (no reproducible en el entorno de desarrollo)
- [ ] MIDI real con el Alesis Q49 y el piano
- [ ] Demucs en la RTX 5060 (PyTorch cu128)
- [ ] Respuestas del asistente con Ollama + qwen2.5:7b
- [ ] Descarga de los samples de piano Salamander

## Sprint 3 — Entrenamiento, rearmonización y calidad ✅
- [x] feature/refactor-backend — API pública de voicings, tests de propiedades (invariantes musicales)
- [x] feature/rearmonizar — motor de rearmonización (sustitutos para una melodía/acorde) + pantalla
- [x] feature/oido — entrenamiento auditivo (intervalos, acordes, funciones, cadencias) respondiendo con el MIDI
- [x] feature/lectura — entrenador de lectura de partituras por niveles, respondiendo con el MIDI
- [x] feature/transporte-midi — transportar progresiones, exportar a .mid y modo práctica en bucle
- [x] feature/inicio-ui — pantalla de inicio, círculo de quintas, avisos, preferencias persistentes, pulido visual
- [x] feature/e2e-ci — tests end-to-end con Playwright y CI en GitHub Actions
- [x] feature/asistente-rearmonizacion — el asistente calcula sustituciones y conoce los módulos nuevos
- [x] PR develop → main (Sprint 3)

## Sprint 4 — Aprender a usar la app y a tocar cada acorde ✅
- [x] feature/tutor-acordes — voicings a dos manos, digitación sugerida, inversiones y estilos (backend + tests)
- [x] feature/tutor-ui — tutor en Rearmonizar: teclado con dedos, pentagrama, paso a paso, arpegios, modo espera, grabar y comparar
- [x] feature/tour — tour guiado con cuadros de diálogo y flechas (desde Inicio y con «?» en cada pantalla)
- [x] feature/grabadora — grabadora MIDI en el Laboratorio (reproducir y exportar lo tocado)
- [x] feature/rendimiento — carga diferida de pantallas y tests unitarios del frontend (Vitest)
- [x] feature/controles-midi — fader, modulación, pitch bend, transporte en la app, botones asignables y monitor MIDI
- [x] PR develop → main (Sprint 4)

## Sprint 5 — Modo canción ✅
- [x] feature/detector-acordes — banco de pruebas y detector más preciso (con pistas: acorde exacto 70 % → 90 %), alternativas por acorde
- [x] feature/letra — letra con acordes (Whisper o letra pegada alineada), karaoke, ajuste de versos y validación
- [x] feature/tutorial-cancion — tutorial de piano tipo vídeo: notas que caen, dos manos con dedos, inversiones encadenadas, modo espera
- [x] PR develop → main (Sprint 5)

## Sprint 6 — Interfaz, detector v2 e instrumentos ✅
- [x] feature/detector-v2 — modelo de notas de basic-pitch (ONNX) fusionado con el cromagrama y banco realista con instrumentos sampleados (mezcla completa: exacto 64,7 % → 73,6 %)
- [x] feature/instrumentos — actividad de cada pista (oculta las vacías) y reconocimiento de instrumentos con AST/AudioSet para nombrar cada pista
- [x] feature/revision-ui — tabla de acordes por compases, auditoría automática de desbordes (5 tamaños) y correcciones en móvil/tablet
- [x] PR develop → main (Sprint 6)

## Sprint 7 — Caza de bugs ✅
- [x] feature/fuzz-api — fuzzing de todos los endpoints (ninguna entrada debe dar error 500)
- [x] feature/robot-ui — recorrido automático de la interfaz pulsando todo, sin errores de consola ni peticiones fallidas
- [x] fix/* — una rama por bug encontrado
- [x] PR develop → main (Sprint 7)

## Sprint 8 — Base de guitarra ✅
- [x] feature/modo-instrumento — interruptor piano/guitarra global (Inicio y menú)
- [x] feature/guitarra-dominio — afinación, mástil, acordes con digitación, cejilla y tocabilidad (backend + tests)
- [x] feature/guitarra-sonido — muestras de guitarra de nailon (FluidR3, MIT)
- [x] feature/modo-instrumento — incluye mástil interactivo, diagrama de acorde y adaptador Keys (piano o mástil)
- [x] PR develop → main (Sprint 8)

## Sprint 9 — La app en guitarra ✅
- [x] Tutor de acordes de guitarra: posiciones con diagrama, cejilla, montar el acorde dedo a dedo con modo espera, rasgueos y arpegios p-i-m-a, práctica con grabación (vale el mástil o un teclado MIDI en cualquier octava)
- [x] «Cómo se toca» elige piano o guitarra según el modo (Laboratorio, Rearmonizar, Letra y acordes)
- [x] Tutorial de canción en guitarra: pista de acordes, diagrama actual y siguiente, cejillas recomendadas, posiciones que minimizan el movimiento de la mano, modo espera y karaoke
- [x] Lectura en guitarra: clave de Sol octavada y niveles por cuerdas y posiciones
- [x] Rearmonizar con mini diagramas; textos e iconos según el instrumento
- [x] Arreglo: con cejilla, las notas de la posición son las que suenan (el modo espera esperaba otras)
- [x] PR develop → main (Sprint 9)

## Sprint 10 — Guitarra flamenca ✅
- [x] Pantalla «Guitarra flamenca»: compás de cada palo con rasgueo (básico, continuo, abanico o pulgar), golpe en los acentos, palmas de metrónomo y tablatura tiempo a tiempo
- [x] Técnicas de rasgueo con su notación (p i m a c, ↓ ↑, +G) y escucha en bucle
- [x] Tonos: por arriba (Mi), por medio (La), granaína (Si) y taranta (Fa♯) con la cadencia andaluza y sus posiciones
- [x] Cejilla en todo el compás (diagramas con la forma que haces y lo que suena)
- [x] Arreglos: el «?» del tour abría el de la pantalla anterior durante la carga; palma y golpe a la vez rompían el audio
- [x] PR develop → main (Sprint 10)

## Sprint 11 — Modo canción fiable ✅
- [x] Flujo probado con Demucs, Whisper y el reconocedor de instrumentos reales (antes solo con simulados)
- [x] Separación en proceso propio (sin ffmpeg ni torchaudio), con progreso real, límite de tiempo y reintento en CPU; si falla, acordes de la mezcla
- [x] Canción lista en cuanto hay acordes; instrumentos en segundo plano, en otra cola y con límite de tiempo (una descarga colgada bloqueaba todas las canciones)
- [x] Reconocedor multietiqueta (sigmoide): con softmax no reconocía nada
- [x] Reproductor multipista con un solo reloj (Ogg Vorbis multicanal + Web Audio), medidores, estados de carga y error
- [x] Silencios como «sin acorde», compases alineados con los cambios de acorde, detección de 3/4, acorde actual y siguientes
- [x] Reintentar, y recuperación de trabajos interrumpidos al arrancar
- [x] Importar el audio de un enlace de YouTube (yt-dlp)
- [x] PR develop → main (Sprint 11)

## Sprint 12 — Guitarra de verdad y diccionario de acordes ✅
- [x] En guitarra, los acordes se muestran con su posición de guitarra (no con las octavas exactas del piano)
- [x] Mástil adaptable al hueco, con ventana para posiciones altas; el punto sale en la casilla pulsada
- [x] Laboratorio: montar acordes con el ratón (una nota por cuerda) y rasguear
- [x] Diccionario de acordes: 63 tipos × 12 fundamentales con fórmula, notas, piano, guitarra y tutor en los dos instrumentos
- [x] Buscador de posiciones 8 veces más rápido y con caché
- [x] PR develop → main (Sprint 12)

## Sprint 13 — Nueva imagen (pendiente)
- [ ] Identidad visual propia y portada de bienvenida con el piano y la guitarra: al elegir uno se amplía y las funciones aparecen como partes del instrumento

## Ideas futuras
- Transcripción nota a nota (basic-pitch) para ver la melodía y los voicings en piano roll
- Exportar a MusicXML lo transcrito
