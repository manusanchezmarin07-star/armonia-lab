// Iconos de trazo (estilo Lucide, dibujados a mano para no añadir dependencias).
const P = (d: string | string[]) => () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((x, i) => <path key={i} d={x} />)}
  </svg>
)
export const IconLab = P(['M9 3h6', 'M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3', 'M7 15h10'])
export const IconBridge = P(['M3 18h18', 'M5 18v-6', 'M19 18v-6', 'M3 12c3-5 15-5 18 0', 'M12 7v11'])
export const IconScale = P(['M4 19h4v-4H4z', 'M10 19h4v-8h-4z', 'M16 19h4V7h-4z', 'M4 5l16 0'])
export const IconMirror = P(['M12 3v18', 'M8 7 4 12l4 5', 'M16 7l4 5-4 5'])
export const IconAnalyze = P(['M4 6h16', 'M4 12h10', 'M4 18h7', 'm16 16 2 2 4-4'])
export const IconRhythm = P(['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'])
export const IconBook = P(['M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z', 'M8 7h8', 'M8 11h6'])
export const IconStems = P(['M3 6h18', 'M3 12h18', 'M3 18h18', 'M7 4v4', 'M15 10v4', 'M10 16v4'])
export const IconBach = P(['M9 18V5l12-2v13', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'])
export const IconChat = P(['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 13h5'])
export const IconPlay = P('M7 4v16l13-8z')
export const IconStop = P('M6 6h12v12H6z')
export const IconArrow = P(['M5 12h14', 'm13 6 6 6-6 6'])
export const IconPlus = P(['M12 5v14', 'M5 12h14'])
export const IconTrash = P(['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14'])
export const IconMidi = P(['M4 6h16v12H4z', 'M8 10v4', 'M12 10v4', 'M16 10v4'])
export const IconSpark = P(['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'm6 6 2.5 2.5', 'm15.5 15.5 2.5 2.5', 'm6 18 2.5-2.5', 'm15.5 8.5 2.5-2.5'])
export const IconHome = P(['M3 11 12 4l9 7', 'M5 10v10h14V10', 'M10 20v-6h4v6'])
export const IconEar = P(['M7 9a5 5 0 1 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0', 'M10 9a2 2 0 1 1 4 0'])
export const IconScore = P(['M3 6h18', 'M3 10h18', 'M3 14h18', 'M3 18h18', 'M9 4v12', 'M9 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0'])
