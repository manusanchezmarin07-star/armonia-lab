# Plan de sprints — Armonía Lab

Gitflow: `main` (estable) ← PR por sprint ← `develop` ← `feature/*` (una por tarea) · `hotfix/*` para bugs en main.

## Sprint 1 — Núcleo de estudio (MVP)
- [x] feature/motor-teoria — acordes, tonalidades, funciones, armonía negativa, modulaciones, escalas simétricas, palos (tests vs music21)
- [ ] feature/api — FastAPI por capas (routers → servicios → dominio)
- [ ] feature/frontend-base — React+TS: diseño, teclado, audio (Tone.js), MIDI (Web MIDI: Alesis Q49 / piano)
- [ ] feature/laboratorio — reconocimiento de acordes en directo + transición entre acordes
- [ ] feature/puentes — rutas de modulación animadas
- [ ] feature/escalas — modos y simétricas
- [ ] feature/armonia-negativa
- [ ] feature/analizador — análisis de progresiones + biblioteca personal
- [ ] feature/ritmo — compás flamenco y amalgamas
- [ ] feature/instalador-windows — install.ps1 / start.bat
- [ ] PR develop → main (Sprint 1)

## Sprint 2 — Estudio de genios y pistas
- [ ] feature/bach — corales de Bach (corpus music21) con análisis
- [ ] feature/pistas — separación Demucs (GPU) + acordes por tiempo + corrección por MIDI
- [ ] feature/asistente — asistente local (Ollama/Qwen) solo de música, con base de conocimiento local y modo bot sin IA
- [ ] PR develop → main (Sprint 2)
