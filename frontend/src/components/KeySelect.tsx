import { KEYS, keyLabel } from '../lib/music'

export default function KeySelect({ value, onChange, allowNone, label }: {
  value: string; onChange: (v: string) => void; allowNone?: boolean; label?: string
}) {
  return (
    <label>
      {label && <span className="label">{label}</span>}
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowNone && <option value="">Detectar automáticamente</option>}
        <optgroup label="Mayores">{KEYS.filter((k) => !k.endsWith('m')).map((k) => <option key={k} value={k}>{keyLabel(k)}</option>)}</optgroup>
        <optgroup label="Menores">{KEYS.filter((k) => k.endsWith('m')).map((k) => <option key={k} value={k}>{keyLabel(k)}</option>)}</optgroup>
      </select>
    </label>
  )
}
