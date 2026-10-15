/**
 * Rough "is this text written in another language than the viewer's?" check, used to decide whether a
 * translate button is worth showing under user-written text (comments, reviews, messages ...).
 * It is only a hint: the real translation happens on click, and an unchanged result hides the button.
 */
const RANGES = {
  hangul: /[ᄀ-ᇿ㄰-㆏가-힯]/g,
  kana: /[぀-ヿ]/g,
  han: /[㐀-䶿一-鿿]/g,
  cyrillic: /[Ѐ-ӿ]/g,
  arabic: /[؀-ۿݐ-ݿ]/g,
  latin: /[A-Za-zÀ-ɏ]/g,
} as const;

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const STOP: Record<string, string[]> = {
  en: 'the and is are was to of for with this that it you your i my me we have has not but on in at be can will please thanks thank hello hi great nice good love watch price shipping ship quality looks beautiful how much when available size color order item product buy want from there what which'.split(' '),
  fr: 'le la les des une un est sont pour avec ce cette que qui vous je mon ma nous pas mais sur dans au aux et ou merci bonjour prix livraison belle montre très'.split(' '),
  de: 'der die das und ist sind nicht ein eine mit für auf ich du sie wir aber von zu den dem im danke hallo preis versand uhr sehr schön'.split(' '),
  it: 'il lo la gli le un una è sono per con che non mi ti ci ma di del della nel grazie ciao prezzo spedizione orologio molto bello'.split(' '),
  nl: 'de het een en is zijn niet met voor op ik je jij wij maar van naar dank hallo prijs verzending horloge heel mooi'.split(' '),
};
const STOP_SETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v)]));

function latinLooksForeign(s: string, lang: string): boolean {
  if (lang === 'la') return true;
  const words = s.toLowerCase().match(/[a-zÀ-ɏ]+/g) ?? [];
  if (!words.length) return false;
  const score: Record<string, number> = {};
  for (const [k, set] of Object.entries(STOP_SETS)) score[k] = words.filter(w => set.has(w)).length;
  const best = Math.max(...Object.values(score));
  if (best === 0) return words.length >= 4; // no clue: only offer the button for longer text
  return (score[lang] ?? 0) < best;
}

/** True when `text` is probably not in `lang` (the app language) and has real letters to translate. */
export function needsTranslation(text: string, lang: string): boolean {
  const s = text.trim();
  if (!s || s.length > 3000) return false;
  const letters = count(s, /\p{L}/gu);
  if (letters < 2) return false;
  const share = (re: RegExp) => count(s, re) / letters;
  const hangul = share(RANGES.hangul), kana = share(RANGES.kana), han = share(RANGES.han), cyr = share(RANGES.cyrillic), ara = share(RANGES.arabic);
  switch (lang) {
    case 'ko': return hangul < 0.3;
    case 'ja': return kana + han < 0.3;
    case 'zh': return han < 0.3 || kana >= 0.1;
    case 'ru': return cyr < 0.3;
    case 'ar': return ara < 0.3;
    default: // Latin-script app languages
      if (hangul + kana + han + cyr + ara >= 0.3) return true;
      return latinLooksForeign(s, lang);
  }
}
