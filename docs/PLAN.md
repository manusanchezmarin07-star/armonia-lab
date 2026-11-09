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

## Sprint 8 — Base de guitarra
- [ ] feature/modo-instrumento — interruptor piano/guitarra global (Inicio y menú)
- [ ] feature/guitarra-dominio — afinación, mástil, acordes con digitación, cejilla y tocabilidad (backend + tests)
- [ ] feature/guitarra-sonido — muestras de guitarra de nailon (FluidR3, MIT)
- [ ] feature/mastil — componentes de mástil y diagrama de acorde
- [ ] PR develop → main (Sprint 8)

## Sprint 9 — La app en guitarra
- [ ] Laboratorio, Escalas, Tutor de acordes, Rearmonizar, Tutorial de canción y Lectura adaptados a guitarra
- [ ] PR develop → main (Sprint 9)

## Sprint 10 — Guitarra flamenca
- [ ] Rasgueos y su notación, compás con rasgueo, cadencia andaluza, por arriba / por medio, cejilla y tablatura
- [ ] PR develop → main (Sprint 10)

## Ideas futuras
- Transcripción nota a nota (basic-pitch) para ver la melodía y los voicings en piano roll
- Exportar a MusicXML lo transcrito
