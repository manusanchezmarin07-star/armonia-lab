/** Leyenda de colores (puntos + texto) usada bajo teclados y líneas de tiempo. */
export default function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="row small text-2" style={{ marginTop: 10, gap: 16 }}>
      {items.map(([color, label]) => (
        <span key={label} className="row" style={{ gap: 6 }}><span className="dot" style={{ background: color }} /> {label}</span>
      ))}
    </div>
  )
}
