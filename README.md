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
| **Analizador** | Grados romanos, funciones, dominantes secundarias, sustitutos tritonales, préstamos modales y detección de modulaciones. |
| **Compás y palos** | Soleá, alegrías, bulería, seguiriya, tangos, sevillanas y compases de amalgama, en reloj y en línea, con metrónomo de palmas. |
| **Mi biblioteca** | Tus transcripciones por artista (Jacob Collier, Bach, Vicente Marín Trío, Emily Bear...). Se guardan en `data/`. |
| **Pistas y acordes** | Sube una canción: Demucs separa voz, bajo, piano, guitarra y batería en tu GPU; se detectan pulso, tonalidad y acordes en una línea de tiempo. Aísla una pista, ralentízala sin cambiar el tono, repite un acorde en bucle y corrígelo tocándolo en tu MIDI. |
| **Corales de Bach** | Los corales del corpus de music21 con su partitura, voces silenciables y análisis acorde a acorde (con music21 como segunda opinión). |
| **Asistente** | Profesor local con Ollama (Qwen 2.5 7B por defecto) que **solo habla de música**. Las notas y acordes los calcula el motor de teoría y las explicaciones salen de `backend/knowledge` con fuentes citadas. Sin Ollama funciona en modo bot. |

## Asistente local

- Necesita [Ollama](https://ollama.com) abierto. El instalador descarga `qwen2.5:7b`, que cabe en 8 GB de VRAM.
- Para usar otro modelo: variable de entorno `OLLAMA_MODEL` (por ejemplo `qwen2.5:14b` si tienes más VRAM).
- La base de conocimiento son ficheros Markdown en `backend/knowledge/`. Puedes añadir los tuyos (por ejemplo, apuntes
  sobre Vicente Marín Trío) con el mismo formato: cabecera `title` y `sources`, y secciones `## `.

## Fiabilidad

La teoría no la "adivina" una IA: está programada en `backend/app/domain` y verificada con tests automáticos que
comparan cada resultado con **music21** (librería académica del MIT). Las explicaciones de ritmo y escalas citan
sus fuentes. Ejecuta los tests con:

```bash
.venv\Scripts\python -m pytest backend/tests
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
