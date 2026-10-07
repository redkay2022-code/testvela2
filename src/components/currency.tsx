import { Globe } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { currencies, currencyLabels, isCurrency, setActiveCurrency, type Currency } from '@/lib/currency';
import { getUsdRates } from '@/lib/rates.functions';
import { applyDomTranslation } from '@/lib/dom-translate';
import { setUsdRates } from '@/lib/currency';
import { defaultCurrency, detectLocale, isLang, langLabels, langs, setActiveLang, t, type Lang } from '@/lib/i18n';

const CUR_KEY = 'vela-currency', LANG_KEY = 'vela-lang';
type Ctx = { currency: Currency; lang: Lang; setCurrency: (c: Currency) => void; setLang: (l: Lang) => void };
const LocaleCtx = createContext<Ctx>({ currency: 'USD', lang: 'en', setCurrency: () => {}, setLang: () => {} });

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCur] = useState<Currency>('USD');
  const [lang, setL] = useState<Lang>('en');
  const [ratesAt, setRatesAt] = useState('');
  useEffect(() => { void getUsdRates().then(r => { if (r) { setUsdRates(r.rates); setRatesAt(r.updated); } }).catch(() => {}); }, []);
  useEffect(() => {
    const detected = detectLocale(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages ?? [navigator.language]);
    const savedLang = localStorage.getItem(LANG_KEY), savedCur = localStorage.getItem(CUR_KEY);
    setL(isLang(savedLang) ? savedLang : detected.lang);
    setCur(isCurrency(savedCur) ? savedCur : detected.currency);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; void applyDomTranslation(lang); }, [lang]);
  const setCurrency = (c: Currency) => { localStorage.setItem(CUR_KEY, c); setCur(c); };
  const setLang = (l: Lang) => {
    localStorage.setItem(LANG_KEY, l); setL(l);
    if (!localStorage.getItem(CUR_KEY)) setCur(defaultCurrency[l]);
  };
  setActiveCurrency(currency); setActiveLang(lang);
  // Re-key so every formatter and translated string re-renders in the chosen locale.
  return <LocaleCtx.Provider value={{ currency, lang, setCurrency, setLang }}><div key={`${lang}-${currency}-${ratesAt}`} style={{ display: 'contents' }}>{children}</div></LocaleCtx.Provider>;
}
export const useCurrency = () => useContext(LocaleCtx);

export function CurrencySelect({ className = '' }: { className?: string }) {
  const { currency, lang, setCurrency, setLang } = useCurrency();
  const [open, setOpen] = useState(false);
  return <span className={`locale-menu ${className}`}><button type="button" className="locale-trigger" aria-label={t('language')} aria-expanded={open} onClick={() => setOpen(o => !o)}><Globe size={19}/></button>{open && <span className="locale-selects">
    <select aria-label={t('language')} className="currency-select" value={lang} onChange={e => { if (isLang(e.target.value)) setLang(e.target.value); }}>
      {langs.map(l => <option key={l} value={l}>{langLabels[l]}</option>)}
    </select>
    <select aria-label="Currency" className="currency-select" value={currency} onChange={e => { if (isCurrency(e.target.value)) setCurrency(e.target.value); }}>
      {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
    </select>
  </span>}</span>;
}
