# Arquitectura

```
armonia-lab/
├── backend/                 Python 3.12 · FastAPI
│   ├── app/
│   │   ├── domain/          Teoría musical pura (sin dependencias de red ni disco)
│   │   │   ├── pitch.py         notas, pitch classes, deletreo enarmónico
│   │   │   ├── chords.py        identificación, cifrado americano, tensiones
│   │   │   ├── keys.py          tonalidades, grados, funciones, armonía negativa
│   │   │   ├── scales.py        modos y escalas simétricas (Messiaen)
│   │   │   ├── modulation.py    rutas de modulación + conducción de voces
│   │   │   ├── analysis.py      análisis de progresiones (Viterbi sobre tonalidades)
│   │   │   └── rhythm.py        palos flamencos y compases
│   │   ├── application/     Casos de uso: orquestan el dominio para la API
│   │   ├── infrastructure/  Disco (JSON), music21, Demucs, Ollama...
│   │   └── api/routers/     Endpoints REST (validación con Pydantic)
│   ├── knowledge/           Base de conocimiento local del asistente (Markdown con fuentes)
│   └── tests/               Tests contrastados con music21
├── frontend/                React 19 + TypeScript + Vite
│   └── src/
│       ├── lib/             api, audio (Tone.js), midi (Web MIDI), estado de entrada
│       ├── components/      Piano SVG, pentagrama (VexFlow), reloj de notas, selectores
│       └── pages/           Una pantalla por módulo
├── scripts/install.ps1      Instalador de Windows
├── INSTALAR.bat / ARRANCAR.bat
└── data/                    Datos del usuario (no se versiona)
```

## Decisiones técnicas

- **Capas**: el dominio no sabe nada de HTTP ni de disco. Así se testea a fondo y se puede reutilizar
  (por ejemplo, el asistente de IA llama a las mismas funciones que la web).
- **Un solo proceso**: FastAPI sirve también la web compilada. El usuario arranca una sola cosa.
- **Web en vez de app nativa**: Web MIDI, Tone.js y VexFlow son lo más maduro para música interactiva.
- **Análisis con Viterbi**: cambiar de tonalidad "cuesta" más que explicar un acorde cromático, para no
  inventar modulaciones en cada dominante secundaria.
- **Conducción de voces**: se elige el voicing que minimiza el movimiento total (fuerza bruta acotada). Es lo
  que hace visible por qué un cambio "brusco" suena suave.
- **Datos locales en JSON**: app personal de un usuario; los datos son legibles y portables.
