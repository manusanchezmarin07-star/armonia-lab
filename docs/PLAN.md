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

## Ideas futuras
- Transcripción nota a nota (basic-pitch) para ver la melodía y los voicings en piano roll
- Exportar a MusicXML lo transcrito
