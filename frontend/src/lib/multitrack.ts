// Reproductor de canciones con pistas: UN solo elemento <audio> con un fichero
// multicanal (dos canales por pista) repartido por Web Audio a un control de
// volumen por pista.
//
// Por qué así y no un <audio> por pista: varios elementos no comparten reloj. Para
// que no se separen había que recolocarlos a saltos (cortes y chasquidos) y aun así
// quedaban desfasados unos milisegundos, que suena a eco/flanger al sumar las pistas.
// Con un único elemento es imposible que se desincronicen y además se conserva el
// cambio de velocidad sin cambiar el tono, que es del navegador.

export interface TrackLayout { id: string; channels: number[] }

/** Volumen de cada pista dados los silencios, el «solo» y los deslizadores. Función pura para poder probarla. */
export function trackGains(ids: string[], vol: Record<string, number>, muted: Record<string, boolean>, solo: string | null) {
  const out: Record<string, number> = {}
  ids.forEach((id) => { out[id] = (solo ? solo === id : !muted[id]) ? (vol[id] ?? 1) : 0 })
  return out
}

export class SongPlayer {
  readonly audio: HTMLAudioElement
  private ctx: AudioContext | null = null
  private gains: Record<string, GainNode> = {}
  private meters: Record<string, AnalyserNode> = {}
  private pending: Record<string, number> = {}
  private buf = new Float32Array(1024)

  /**
   * @param url     audio a reproducir (multipista o la mezcla en estéreo)
   * @param layout  canales de cada pista dentro del fichero
   * @param total   canales del fichero (el separador necesita una salida por canal)
   */
  constructor(url: string, private layout: TrackLayout[], private total: number) {
    this.audio = new Audio(url)
    this.audio.preload = 'auto'
    this.audio.preservesPitch = true // ralentizar sin cambiar el tono
  }

  /** El grafo se monta en el primer Play: un AudioContext creado sin gesto del usuario nace suspendido. */
  private graph() {
    if (this.ctx) return
    const ctx = new AudioContext()
    const src = ctx.createMediaElementSource(this.audio)
    const split = ctx.createChannelSplitter(Math.max(2, this.total))
    src.connect(split)
    this.layout.forEach((t) => {
      const merge = ctx.createChannelMerger(2)
      split.connect(merge, t.channels[0], 0)
      split.connect(merge, t.channels[1] ?? t.channels[0], 1)
      const gain = ctx.createGain()
      gain.gain.value = this.pending[t.id] ?? 1
      const meter = ctx.createAnalyser()
      meter.fftSize = 1024
      merge.connect(gain).connect(ctx.destination)
      merge.connect(meter) // el medidor va antes del volumen: enseña lo que hay en la pista aunque esté silenciada
      this.gains[t.id] = gain
      this.meters[t.id] = meter
    })
    this.ctx = ctx
  }

  async play() {
    this.graph()
    if (this.ctx!.state !== 'running') await this.ctx!.resume()
    await this.audio.play()
  }

  pause() { this.audio.pause() }
  seek(t: number) { this.audio.currentTime = Math.max(0, t) }
  get time() { return this.audio.currentTime }
  setRate(r: number) { this.audio.playbackRate = r }

  setGains(g: Record<string, number>) {
    this.pending = g
    if (!this.ctx) return
    // Rampa corta en vez de salto: cambiar el volumen de golpe hace «clic».
    Object.entries(g).forEach(([id, v]) => this.gains[id]?.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.015))
  }

  /** Nivel actual de una pista (0–1), para los medidores del mezclador. */
  level(id: string) {
    const m = this.meters[id]
    if (!m) return 0
    m.getFloatTimeDomainData(this.buf)
    let sum = 0
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i]
    // Raíz cuadrada del RMS: las pistas flojas (un bajo, una voz suave) también se ven moverse.
    return Math.min(1, Math.sqrt(Math.sqrt(sum / this.buf.length)) * 1.5)
  }

  dispose() {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}
