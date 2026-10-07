// All stored prices (item and Full Set Box) use USD as the base currency.
export type Currency = 'USD' | 'KRW' | 'CNY';
export const BASE_CURRENCY: Currency = 'USD';
export const currencies: readonly Currency[] = ['USD', 'KRW', 'CNY'];
export const currencyLabels: Record<Currency, string> = { USD: '$ USD', KRW: '₩ KRW', CNY: '¥ CNY' };
// Indicative reference rates (1 USD = x). Not a live market feed.
export const usdRates: Record<Currency, number> = { USD: 1, KRW: 1380, CNY: 7.2 };
const locales: Record<Currency, string> = { USD: 'en-US', KRW: 'ko-KR', CNY: 'zh-CN' };
let active: Currency = 'USD';
export const activeCurrency = () => active;
export function setActiveCurrency(c: Currency) { active = c; }
export function convert(usd: number, c: Currency = active) { return usd * usdRates[c]; }
export function formatMoney(usd: number, c: Currency = active) {
  return new Intl.NumberFormat(locales[c], { style: 'currency', currency: c, maximumFractionDigits: c === 'USD' ? 2 : 0, minimumFractionDigits: c === 'USD' ? 2 : 0 }).format(convert(usd, c));
}
export const krwToUsd = (krw: number) => krw / usdRates.KRW;
export function detectCurrency(timeZone: string, languages: readonly string[]): Currency {
  if (timeZone === 'Asia/Seoul') return 'KRW';
  if (/^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Kashgar)$/.test(timeZone)) return 'CNY';
  const lang = (languages[0] ?? '').toLowerCase();
  if (lang.startsWith('ko')) return 'KRW';
  if (lang === 'zh-cn' || lang === 'zh-hans' || lang === 'zh') return 'CNY';
  return 'USD';
}
export const isCurrency = (v: unknown): v is Currency => typeof v === 'string' && (currencies as readonly string[]).includes(v);
