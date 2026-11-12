// Piano de cola visto desde arriba, con la tapa abierta, dibujado a mano en SVG (360 × 700).
// Las coordenadas de sus partes se usan en la portada para colgar de ellas las funciones.
export const PIANO = { w: 360, h: 700 }

const CASE = 'M36 560 L36 150 C36 86 86 44 150 44 C218 44 252 92 258 150 C266 232 324 250 324 334 L324 560 Z'
const PLATE = 'M54 470 L54 156 C54 100 96 64 150 64 C204 64 234 104 240 156 C248 240 306 256 306 338 L306 470 Z'

export default function PianoArt() {
  const whites = Array.from({ length: 28 }, (_, i) => i)
  // Teclas negras: en cada grupo de 7 blancas faltan entre Mi–Fa y Si–Do.
  const blacks = whites.filter((i) => ![2, 6].includes(i % 7) && i < 27)
  const kw = 288 / 28
  return (
    <g>
      <defs>
        <linearGradient id="p-plate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9a84e" /><stop offset="0.6" stopColor="#b98432" /><stop offset="1" stopColor="#8f6120" />
        </linearGradient>
        <linearGradient id="p-case" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2b2420" /><stop offset="1" stopColor="#0d0a08" /></linearGradient>
      </defs>
      {/* Tapa abierta: se ve por detrás, como un espejo lacado */}
      <path d={CASE} fill="#3d6df2" opacity={0.16} transform="translate(-22 -16)" stroke="#8eadff" strokeOpacity={0.5} strokeWidth={1.5} />
      {/* Mueble */}
      <path d={CASE} fill="url(#p-case)" stroke="#000" strokeWidth={3} strokeLinejoin="round" />
      <path d={CASE} fill="none" stroke="#fff" strokeOpacity={0.13} strokeWidth={1.2} transform="translate(180 300) scale(0.985) translate(-180 -300)" />
      {/* Arpa (bastidor dorado) y tabla armónica */}
      <path d={PLATE} fill="url(#p-plate)" stroke="#5f3f12" strokeWidth={2} />
      {[[110, 130, 16], [170, 120, 13], [215, 190, 12], [262, 300, 11]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} fill="#17100a" opacity={0.55} />)}
      {/* Cuerdas: largas a la izquierda (graves), cortas a la derecha (agudas) */}
      {Array.from({ length: 30 }, (_, i) => {
        const x = 62 + i * 8.2
        const top = i < 12 ? 92 + i * 3 : 128 + (i - 12) * 11.5
        return <line key={i} x1={x} y1={452} x2={x + (i < 12 ? 26 : 4)} y2={top} stroke={i < 9 ? '#c98a4a' : '#f1ece3'} strokeWidth={i < 9 ? 1.5 : 0.8} opacity={0.85} />
      })}
      {/* Puente sobre la tabla armónica */}
      <path d="M78 150 C128 138 198 190 232 262 C250 300 276 318 296 350" fill="none" stroke="#4a2c18" strokeWidth={6} strokeLinecap="round" />
      {/* Clavijas de afinación y macillos */}
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={62 + i * 8.2} cy={456 - (i % 2) * 5} r={1.9} fill="#e9e1d0" />)}
      <rect x={54} y={466} width={252} height={11} rx={2} fill="#efe6d2" stroke="#8d8573" strokeWidth={1} />
      {Array.from({ length: 30 }, (_, i) => <line key={i} x1={62 + i * 8.2} x2={62 + i * 8.2} y1={467} y2={476} stroke="#b3243a" strokeWidth={1.6} />)}
      {/* Atril con la partitura y metrónomo */}
      <rect x={96} y={488} width={168} height={24} rx={3} fill="#17100a" stroke="#000" strokeWidth={1.5} />
      <rect x={128} y={484} width={104} height={25} rx={1.5} fill="#f6f0e6" />
      {[490, 494, 498, 502].map((y) => <line key={y} x1={134} x2={226} y1={y} y2={y} stroke="#12100d" strokeWidth={0.7} />)}
      <line x1={180} x2={180} y1={484} y2={509} stroke="#c7bcad" strokeWidth={0.8} />
      <path d="M70 510 L78 486 L88 486 L96 510 Z" fill="#b3243a" stroke="#5c0f1c" strokeWidth={1.2} />
      <line x1={83} y1={507} x2={90} y2={489} stroke="#f6f0e6" strokeWidth={1.4} strokeLinecap="round" />
      {/* Teclado */}
      <rect x={36} y={514} width={288} height={12} fill="#0d0a08" />
      {whites.map((i) => <rect key={i} x={36 + i * kw} y={526} width={kw - 0.7} height={62} rx={1.2} fill="#f6f0e6" stroke="#8d8573" strokeWidth={0.5} />)}
      {blacks.map((i) => <rect key={i} x={36 + (i + 1) * kw - 3.2} y={526} width={6.4} height={39} rx={1} fill="#12100d" />)}
      {/* Acorde de Do mayor en albero */}
      {[14, 16, 18].map((i) => <rect key={i} x={36 + i * kw} y={566} width={kw - 0.7} height={22} rx={1.2} fill="#e8b04b" />)}
      <rect x={30} y={588} width={300} height={10} rx={3} fill="#17120f" stroke="#000" strokeWidth={1.5} />
      {/* Pedales */}
      {[164, 180, 196].map((x) => <rect key={x} x={x - 5} y={600} width={10} height={24} rx={5} fill="#d9a84e" stroke="#6b4a15" strokeWidth={1} />)}
      {/* Banqueta */}
      <rect x={112} y={640} width={136} height={52} rx={9} fill="#231a14" stroke="#000" strokeWidth={2} />
      <rect x={121} y={648} width={118} height={36} rx={6} fill="#3a2b20" />
      {[150, 180, 210].map((x) => [658, 674].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.6} fill="#17100a" />))}
    </g>
  )
}
