// Guitarra española de frente, dibujada a mano en SVG (300 × 640).
// Las coordenadas de sus partes se usan en la portada para colgar de ellas las funciones.
export const GUITAR = { w: 300, h: 640 }

const BODY = 'M150 316 C100 316 62 344 62 388 C62 420 84 432 84 454 C84 480 34 494 34 550 C34 602 90 628 150 628 C210 628 266 602 266 550 C266 494 216 480 216 454 C216 432 238 420 238 388 C238 344 200 316 150 316 Z'
// Posición de los trastes (regla del 17,817) entre la cejuela (y=100) y el puente (y=548).
const fretY = (n: number) => 100 + 448 * (1 - Math.pow(2, -n / 12))

export default function GuitarArt() {
  const strings = [0, 1, 2, 3, 4, 5]
  return (
    <g>
      <defs>
        <linearGradient id="g-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9b872" /><stop offset="0.55" stopColor="#d79a4e" /><stop offset="1" stopColor="#b9772f" />
        </linearGradient>
        <linearGradient id="g-neck" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a2416" /><stop offset="0.5" stopColor="#2a190e" /><stop offset="1" stopColor="#3a2416" />
        </linearGradient>
        <radialGradient id="g-hole" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stopColor="#1c110a" /><stop offset="1" stopColor="#060302" /></radialGradient>
      </defs>
      {/* Caja */}
      <path d={BODY} fill="url(#g-top)" stroke="#3b2413" strokeWidth={5} strokeLinejoin="round" />
      <path d={BODY} fill="none" stroke="#f3dcae" strokeWidth={1.4} opacity={0.75} transform="translate(150 472) scale(0.965) translate(-150 -472)" />
      {/* Golpeador: lámina transparente junto a la boca, donde se da el golpe flamenco */}
      <path d="M172 392 C204 398 226 420 224 446 C222 468 206 486 196 520 L172 520 Z" fill="#fff" opacity={0.2} stroke="#fff" strokeOpacity={0.55} strokeWidth={1} />
      {/* Roseta y boca */}
      {[46, 42.5, 39].map((r, i) => <circle key={r} cx={150} cy={430} r={r} fill="none" stroke={['#3d6df2', '#f6f0e6', '#b3243a'][i]} strokeWidth={i === 1 ? 1.4 : 3} strokeDasharray={i === 1 ? undefined : '5 3'} />)}
      <circle cx={150} cy={430} r={35} fill="url(#g-hole)" stroke="#2a190e" strokeWidth={2} />
      {/* Etiqueta del guitarrero, dentro de la boca */}
      <rect x={136} y={438} width={30} height={15} rx={2} fill="#e8dcc4" opacity={0.5} transform="rotate(-8 150 445)" />
      {/* Mástil y diapasón */}
      <rect x={130} y={100} width={40} height={fretY(18) - 100} fill="url(#g-neck)" stroke="#170d07" strokeWidth={1.5} rx={2} />
      {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => <line key={n} x1={130.5} x2={169.5} y1={fretY(n)} y2={fretY(n)} stroke="#c9c2b5" strokeWidth={1.4} />)}
      {[5, 7, 9].map((n) => <circle key={n} cx={150} cy={(fretY(n) + fretY(n - 1)) / 2} r={2.4} fill="#e9dfcc" opacity={0.75} />)}
      {/* Cejilla en el traste 2 */}
      <rect x={124} y={(fretY(1) + fretY(2)) / 2 - 5} width={52} height={10} rx={5} fill="#3d6df2" stroke="#172f7d" strokeWidth={1.2} />
      {/* Cejuela */}
      <rect x={129} y={95} width={42} height={6} rx={1.5} fill="#f6f0e6" />
      {/* Pala con sus ranuras y clavijas */}
      <path d="M127 95 L124 22 C124 10 134 6 150 6 C166 6 176 10 176 22 L173 95 Z" fill="#4a2c18" stroke="#1f1108" strokeWidth={2} />
      <rect x={136} y={24} width={8} height={58} rx={4} fill="#120a05" />
      <rect x={156} y={24} width={8} height={58} rx={4} fill="#120a05" />
      {[32, 52, 72].map((y) => (
        <g key={y}>
          <rect x={108} y={y - 5} width={17} height={10} rx={5} fill="#efe6d2" stroke="#8d8573" strokeWidth={1} />
          <rect x={175} y={y - 5} width={17} height={10} rx={5} fill="#efe6d2" stroke="#8d8573" strokeWidth={1} />
        </g>
      ))}
      {/* Puente */}
      <rect x={100} y={540} width={100} height={18} rx={3} fill="#2a190e" stroke="#140b06" strokeWidth={1.2} />
      <rect x={118} y={544} width={64} height={3.5} rx={1} fill="#f6f0e6" />
      {/* Cuerdas: tres bordones (más gruesos y dorados) y tres primas */}
      {strings.map((i) => (
        <line key={i} x1={134 + i * 6.4} y1={96} x2={122 + i * 11.2} y2={546} stroke={i < 3 ? '#d8b56a' : '#f3ecdd'} strokeWidth={i < 3 ? 1.9 - i * 0.25 : 1} opacity={0.95} />
      ))}
    </g>
  )
}
