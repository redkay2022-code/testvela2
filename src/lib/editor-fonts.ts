/**
 * Free fonts (SIL Open Font License, served by Google Fonts) offered by the video editor's text tool.
 * The stylesheet is added lazily the first time the editor opens; if it cannot load (offline, blocked network) the
 * fallback stack is used, so text still shows — just in a standard typeface.
 */
export type EditorFont = { id: string; label: string; family: string; group: 'ko' | 'en'; fallback: 'sans-serif' | 'serif' | 'cursive' };

export const editorFonts: EditorFont[] = [
  { id: 'noto-sans-kr', label: 'Noto Sans KR', family: 'Noto Sans KR', group: 'ko', fallback: 'sans-serif' },
  { id: 'noto-serif-kr', label: 'Noto Serif KR', family: 'Noto Serif KR', group: 'ko', fallback: 'serif' },
  { id: 'nanum-myeongjo', label: 'Nanum Myeongjo', family: 'Nanum Myeongjo', group: 'ko', fallback: 'serif' },
  { id: 'gowun-batang', label: 'Gowun Batang', family: 'Gowun Batang', group: 'ko', fallback: 'serif' },
  { id: 'black-han-sans', label: 'Black Han Sans', family: 'Black Han Sans', group: 'ko', fallback: 'sans-serif' },
  { id: 'do-hyeon', label: 'Do Hyeon', family: 'Do Hyeon', group: 'ko', fallback: 'sans-serif' },
  { id: 'jua', label: 'Jua', family: 'Jua', group: 'ko', fallback: 'sans-serif' },
  { id: 'gugi', label: 'Gugi', family: 'Gugi', group: 'ko', fallback: 'cursive' },
  { id: 'sunflower', label: 'Sunflower', family: 'Sunflower', group: 'ko', fallback: 'sans-serif' },
  { id: 'single-day', label: 'Single Day', family: 'Single Day', group: 'ko', fallback: 'cursive' },
  { id: 'nanum-pen', label: 'Nanum Pen Script', family: 'Nanum Pen Script', group: 'ko', fallback: 'cursive' },
  { id: 'dokdo', label: 'Dokdo', family: 'Dokdo', group: 'ko', fallback: 'cursive' },
  { id: 'playfair', label: 'Playfair Display', family: 'Playfair Display', group: 'en', fallback: 'serif' },
  { id: 'cinzel', label: 'Cinzel', family: 'Cinzel', group: 'en', fallback: 'serif' },
  { id: 'abril', label: 'Abril Fatface', family: 'Abril Fatface', group: 'en', fallback: 'serif' },
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', group: 'en', fallback: 'sans-serif' },
  { id: 'oswald', label: 'Oswald', family: 'Oswald', group: 'en', fallback: 'sans-serif' },
  { id: 'bebas', label: 'Bebas Neue', family: 'Bebas Neue', group: 'en', fallback: 'sans-serif' },
  { id: 'pacifico', label: 'Pacifico', family: 'Pacifico', group: 'en', fallback: 'cursive' },
  { id: 'lobster', label: 'Lobster', family: 'Lobster', group: 'en', fallback: 'cursive' },
  { id: 'dancing', label: 'Dancing Script', family: 'Dancing Script', group: 'en', fallback: 'cursive' },
  { id: 'marker', label: 'Permanent Marker', family: 'Permanent Marker', group: 'en', fallback: 'cursive' },
];

const byId = new Map(editorFonts.map(f => [f.id, f]));
const LINK_ID = 'vela-editor-fonts';

/** CSS font-family value for a font id ('' / unknown = null, meaning "use the text style's own font"). */
export function fontStack(id: string): string | null {
  const f = byId.get(id);
  return f ? `"${f.family}", ${f.fallback}` : null;
}

/** Adds the Google Fonts stylesheet once. Safe to call repeatedly and during SSR. */
export function ensureEditorFonts() {
  if (typeof document === 'undefined' || document.getElementById(LINK_ID)) return;
  const link = document.createElement('link');
  link.id = LINK_ID; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${editorFonts.map(f => `family=${f.family.replace(/ /g, '+')}`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

/** Makes sure a font is ready before it is drawn on the export canvas (gives up after 3s and uses the fallback). */
export async function loadFontForCanvas(id: string, sample: string) {
  const f = byId.get(id);
  if (!f || typeof document === 'undefined' || !document.fonts) return;
  await Promise.race([document.fonts.load(`40px "${f.family}"`, sample).catch(() => []), new Promise(r => window.setTimeout(r, 3000))]);
}
