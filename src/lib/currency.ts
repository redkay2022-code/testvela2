// All stored prices (item and Full Set Box) use USD as the base currency.
export type Currency = 'USD' | 'KRW' | 'CNY' | 'EUR' | 'RUB' | 'JPY' | 'AED' | 'SAR';
export const BASE_CURRENCY: Currency = 'USD';
export const currencies: readonly Currency[] = ['USD', 'KRW', 'CNY', 'EUR', 'RUB', 'JPY', 'AED', 'SAR'];
export const currencyLabels: Record<Currency, string> = { USD: '$ USD', KRW: '₩ KRW', CNY: '¥ CNY', EUR: '€ EUR', RUB: '₽ RUB', JPY: '¥ JPY', AED: 'AED', SAR: 'SAR' };
// Fallback rates (1 USD = x); replaced by live rates once loaded.
export const usdRates: Record<Currency, number> = { USD: 1, KRW: 1380, CNY: 7.2, EUR: 0.92, RUB: 90, JPY: 150, AED: 3.67, SAR: 3.75 };
export function setUsdRates(next: Partial<Record<Currency, number>>) { for (const [k, v] of Object.entries(next)) if (isCurrency(k) && typeof v === 'number' && v > 0) usdRates[k] = v; usdRates.USD = 1; }
const locales: Record<Currency, string> = { USD: 'en-US', KRW: 'ko-KR', CNY: 'zh-CN', EUR: 'de-DE', RUB: 'ru-RU', JPY: 'ja-JP', AED: 'en-AE', SAR: 'en-SA' };
let active: Currency = 'USD';
export const activeCurrency = () => active;
export function setActiveCurrency(c: Currency) { active = c; }
const dec = (c: Currency) => ['KRW', 'JPY', 'CNY', 'RUB'].includes(c) ? 0 : 2;
export function convert(usd: number, c: Currency = active) { return usd * usdRates[c]; }
export function formatMoney(usd: number, c: Currency = active) {
  return new Intl.NumberFormat(locales[c], { style: 'currency', currency: c, maximumFractionDigits: dec(c), minimumFractionDigits: dec(c) }).format(convert(usd, c));
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
