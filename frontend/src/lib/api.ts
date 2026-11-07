// Cliente de la API. Todas las rutas son relativas: en producción el backend sirve
// la web y en desarrollo Vite hace de proxy, así no hay que configurar URLs.
async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    let msg = `Error ${r.status}`
    try {
      const j = await r.json()
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch { /* respuesta sin JSON */ }
    throw new Error(msg)
  }
  return r.json() as Promise<T>
}

export const api = {
  get: <T>(url: string) => req<T>('GET', url),
  post: <T>(url: string, body: unknown) => req<T>('POST', url, body),
  put: <T>(url: string, body: unknown) => req<T>('PUT', url, body),
  del: <T>(url: string) => req<T>('DELETE', url),
}

export interface Tone { label: string; name: string; note: string; pc: number }
export interface ChordAnalysis {
  roman: string; kind: string; function: string | null; explanation: string; target: string | null; negative_of?: string
}
export interface Reading {
  symbol: string; root: string; quality: string; family: string; inversion: string; tensions: string[];
  omitted: string[]; tones: Tone[]; analysis?: ChordAnalysis
}
export interface VoicedStep {
  symbol: string; label: string; bass: number; upper: number[]; held: number[];
  moves: { from: number; to: number; semitones: number }[]; motion: number
}
export interface Route { name: string; explanation: string; steps: VoicedStep[]; total_motion: number; avg_motion: number }
export interface Pivot { symbol: string; roman_from: string; roman_to: string; function_to: string }
export interface ModulationResult { from: string; to: string; pivots: Pivot[]; routes: Route[]; distance_fifths: number }
export interface Transition {
  common_tones: string[]; root_motion: string; relations: string[]; voicing: VoicedStep[]; motion: number; smoothness: string
}
export interface ScaleSummary { id: string; name: string; family: string; symmetric: boolean; size: number; transpositions: number }
export interface ScaleInfo extends ScaleSummary {
  description: string; tonic: string; steps: number[]; degrees: number[]; pcs: number[]; notes: string[];
  characteristic_pcs: number[]; chords: { degree: number; symbol: string; pcs: number[] }[]
}
export interface AnalyzedChord {
  symbol: string; key: string; notes: string[]; quality: string; analysis: ChordAnalysis; voicing: VoicedStep
}
export interface ProgressionAnalysis {
  key: string; chords: AnalyzedChord[]; modulations: { at: number; from: string; to: string; pivot: string | null }[]
}
export interface NegativePair {
  original: string; negative: string; alternatives: string[]; negative_mirrored_bass: string | null
  original_voicing: { bass: number; upper: number[] }; negative_voicing: { bass: number; upper: number[] }
  original_analysis: ChordAnalysis
}
export interface NegativeResult { key: string; axis: string; pairs: NegativePair[] }
export interface Palo {
  id: string; name: string; beats: number; accents: number[]; grouping: number[]; count_start?: number; bpm: number
  family?: string; description: string; variants?: { name: string; accents: number[] }[]; sources?: string[]
}
export interface LibraryEntry { id: string; title: string; artist: string; key: string | null; progression: string; notes: string; source: string }
