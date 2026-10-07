export type PhoneCountry = { iso: string; dial: string; name: string; flag: string };

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'KR', dial: '82', name: '대한민국', flag: '🇰🇷' },
  { iso: 'CN', dial: '86', name: '中国', flag: '🇨🇳' },
  { iso: 'HK', dial: '852', name: 'Hong Kong', flag: '🇭🇰' },
  { iso: 'TW', dial: '886', name: '台灣', flag: '🇹🇼' },
  { iso: 'JP', dial: '81', name: '日本', flag: '🇯🇵' },
  { iso: 'SG', dial: '65', name: 'Singapore', flag: '🇸🇬' },
  { iso: 'US', dial: '1', name: 'United States', flag: '🇺🇸' },
  { iso: 'CA', dial: '1', name: 'Canada', flag: '🇨🇦' },
  { iso: 'GB', dial: '44', name: 'United Kingdom', flag: '🇬🇧' },
  { iso: 'DE', dial: '49', name: 'Deutschland', flag: '🇩🇪' },
  { iso: 'FR', dial: '33', name: 'France', flag: '🇫🇷' },
  { iso: 'IT', dial: '39', name: 'Italia', flag: '🇮🇹' },
  { iso: 'NL', dial: '31', name: 'Nederland', flag: '🇳🇱' },
  { iso: 'CH', dial: '41', name: 'Schweiz', flag: '🇨🇭' },
  { iso: 'RU', dial: '7', name: 'Россия', flag: '🇷🇺' },
  { iso: 'AE', dial: '971', name: 'الإمارات', flag: '🇦🇪' },
  { iso: 'SA', dial: '966', name: 'السعودية', flag: '🇸🇦' },
  { iso: 'AU', dial: '61', name: 'Australia', flag: '🇦🇺' },
  { iso: 'TH', dial: '66', name: 'ไทย', flag: '🇹🇭' },
  { iso: 'VN', dial: '84', name: 'Việt Nam', flag: '🇻🇳' },
  { iso: 'VA', dial: '39', name: 'Città del Vaticano', flag: '🇻🇦' },
];

const LANG_DEFAULT: Record<string, string> = { ko: 'KR', zh: 'CN', ja: 'JP', en: 'US', de: 'DE', fr: 'FR', it: 'IT', nl: 'NL', ru: 'RU', ar: 'AE', la: 'VA' };

/** Pick the country from the device locale region, then its language. */
export function detectPhoneCountry(): string {
  if (typeof navigator === 'undefined') return 'KR';
  for (const tag of navigator.languages ?? [navigator.language]) {
    const [lang, region] = tag.split('-');
    const r = region?.toUpperCase();
    if (r && PHONE_COUNTRIES.some(c => c.iso === r)) return r;
    const d = lang ? LANG_DEFAULT[lang.toLowerCase()] : undefined;
    if (d) return d;
  }
  return 'KR';
}

/** Build E.164: drop a leading trunk 0 from the local number. */
export function toE164(iso: string, local: string) {
  const c = PHONE_COUNTRIES.find(x => x.iso === iso) ?? PHONE_COUNTRIES[0]!;
  return `+${c.dial}${local.replace(/\D/g, '').replace(/^0+/, '')}`;
}
