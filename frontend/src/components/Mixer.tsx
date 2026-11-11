import { useEffect, useRef, useState } from 'react'

export interface Instrument { name: string; family: string; icon: string; spans: number[][]; share: number; confidence: number }
export interface StemInfo {
  id: string; name: string; active?: boolean; instruments?: Instrument[]
  activity?: { active_ratio: number; spans: number[][] }
}

interface Props {
  stems: StemInfo[]; separated: boolean; duration: number; time: number
  muted: Record<string, boolean>; solo: string | null; vol: Record<string, number>
  onMute: (id: string) => void; onSolo: (id: string) => void; onVol: (id: string, v: number) => void
  onRedetect?: () => void; method?: string
  /** Estado del reconocimiento de instrumentos (va después de que la canción esté lista). */
  status?: string; statusError?: string
  /** Nivel actual (0–1) de una pista mientras suena; sin él no se pintan medidores. */
  level?: (id: string) => number
}

/**
 * Mezclador que se adapta a la canción: solo muestra las pistas que suenan de
 * verdad, nombradas por su contenido, con los instrumentos detectados y una
 * franja que indica en qué partes de la canción intervienen.
 */
export default function Mixer({ stems, separated, duration, time, muted, solo, vol, onMute, onSolo, onVol, onRedetect, method, status, statusError, level }: Props) {
  const [showEmpty, setShowEmpty] = useState(false)
  // Medidores: se pintan directamente en el DOM (sin estado de React) para no repintar
  // el mezclador entero 30 veces por segundo.
  const bars = useRef<Record<string, HTMLElement | null>>({})
  useEffect(() => {
    if (!level) { Object.values(bars.current).forEach((b) => b && (b.style.width = '0%')); return }
    let raf = 0
    const tick = () => {
      Object.entries(bars.current).forEach(([id, b]) => { if (b) b.style.width = `${Math.round(level(id) * 100)}%` })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [level])
  const active = stems.filter((s) => s.active !== false)
  const empty = stems.filter((s) => s.active === false)
  const lane = (spans: number[][] | undefined) => (
    <div className="lane">
      {(spans ?? []).map(([a, b], i) => <span key={i} style={{ left: `${(a / duration) * 100}%`, width: `${((b - a) / duration) * 100}%` }} />)}
      <i style={{ left: `${(time / duration) * 100}%` }} />
    </div>
  )
  const row = (s: StemInfo) => (
    <div key={s.id} className={`mixer-row ${s.active === false ? 'dim' : ''}`}>
      <div className="mixer-name">
        <b>{s.name}</b>
        {s.instruments && s.instruments.length > 0 && (
          <div className="row" style={{ gap: 4, marginTop: 3 }}>
            {s.instruments.slice(0, 4).map((i) => <span key={i.name} className="pill" title={`${Math.round(i.share * 100)} % de la canción`}>{i.icon} {i.name}</span>)}
          </div>
        )}
        {s.id !== 'mezcla' && lane(s.activity?.spans)}
        <div className="meter" aria-hidden><i ref={(el) => { bars.current[s.id] = el }} /></div>
      </div>
      <div className="mixer-ctrl">
        <button className={`btn sm ${muted[s.id] ? '' : 'ghost'}`} style={{ width: 34, justifyContent: 'center', color: muted[s.id] ? 'var(--coral)' : undefined }}
                onClick={() => onMute(s.id)} title="Silenciar" aria-label={`Silenciar ${s.name}`}>M</button>
        <button className="btn sm ghost" style={{ width: 34, justifyContent: 'center', color: solo === s.id ? 'var(--accent)' : undefined, borderColor: solo === s.id ? 'var(--accent)' : undefined }}
                onClick={() => onSolo(s.id)} title="Solo" aria-label={`Solo ${s.name}`}>S</button>
        <input type="range" className="range" min={0} max={1} step={0.01} value={vol[s.id] ?? 1} onChange={(e) => onVol(s.id, +e.target.value)}
               aria-label={`Volumen ${s.name}`} />
      </div>
    </div>
  )
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row">
        <h3 style={{ margin: 0 }}>Mezclador</h3>
        <div className="spacer" />
        {status === 'analizando' && <span className="pill accent">reconociendo instrumentos…</span>}
        {status === 'error' && <span className="pill coral" title={statusError}>no se pudieron reconocer los instrumentos</span>}
        {method && status !== 'analizando' && <span className="small muted">{method}</span>}
        {separated && onRedetect && <button className="btn sm ghost" onClick={onRedetect} title="Volver a reconocer los instrumentos">↻</button>}
      </div>
      {active.map(row)}
      {empty.length > 0 && (
        <div className="small muted">
          Sin contenido en esta canción: {empty.map((s) => s.name).join(', ')}.{' '}
          <button className="btn sm ghost" onClick={() => setShowEmpty((v) => !v)}>{showEmpty ? 'Ocultar' : 'Mostrar'}</button>
        </div>
      )}
      {showEmpty && empty.map(row)}
      {!separated && <p className="small muted" style={{ margin: 0 }}>Sin Demucs solo está la mezcla. Instálalo para separar instrumentos.</p>}
      {separated && (
        <p className="small muted" style={{ margin: 0 }}>Demucs separa en voz, batería, bajo, guitarra, piano y «otros». Los instrumentos que comparten
          pista (por ejemplo, violines y trompetas en «otros») se controlan juntos: separar cada violín no es posible con la tecnología actual.</p>
      )}
    </div>
  )
}
