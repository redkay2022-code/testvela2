import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { currencies, currencyLabels, detectCurrency, isCurrency, setActiveCurrency, type Currency } from '@/lib/currency';

const KEY = 'vela-currency';
const Ctx = createContext<{ currency: Currency; setCurrency: (c: Currency) => void }>({ currency: 'USD', setCurrency: () => {} });

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setState] = useState<Currency>('USD');
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const next = isCurrency(saved) ? saved : detectCurrency(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages ?? [navigator.language]);
    setActiveCurrency(next); setState(next);
  }, []);
  const setCurrency = (c: Currency) => { localStorage.setItem(KEY, c); setActiveCurrency(c); setState(c); };
  setActiveCurrency(currency);
  // Re-key so every price formatter re-renders in the chosen currency.
  return <Ctx.Provider value={{ currency, setCurrency }}><div key={currency} style={{ display: 'contents' }}>{children}</div></Ctx.Provider>;
}
export const useCurrency = () => useContext(Ctx);

export function CurrencySelect({ className = '' }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return <select aria-label="Currency" className={`currency-select ${className}`} value={currency} onChange={e => { if (isCurrency(e.target.value)) setCurrency(e.target.value); }}>
    {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
  </select>;
}
