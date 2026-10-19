import { ShieldCheck } from 'lucide-react';
import { tx } from '@/lib/dom-translate';
import { insuranceFeeFor } from '@/lib/insurance-option';
import { formatMoney } from '@/lib/currency';

/** Optional buyer insurance; seller item price only, excluding the box. */
export function InsuranceOption({ price, checked, onChange, rate = 0.1 }: { price: number | string; checked: boolean; onChange: (next: boolean) => void; rate?: number }) {
  const base = insuranceFeeFor(price), amount = Number(String(price ?? '').replace(/[$,\s]/g, '')), fee = rate === 0.1 ? base : Math.round((Number.isFinite(amount) && amount > 0 ? amount : 0) * rate * 100) / 100, pct = +(rate * 100).toFixed(2);
  return <fieldset className="notranslate mt-5 rounded-lg border border-border p-3" translate="no" data-no-translate="">
    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
      <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={e => onChange(e.target.checked)}/>
      <ShieldCheck size={17} aria-hidden="true"/>
      <span className="notranslate min-w-0 flex-1" translate="no" data-i18n-skip>{tx('Shipping & Customs Insurance')}</span>
      <strong className="shrink-0 text-primary" data-i18n-skip>+{formatMoney(fee)}</strong>
    </label>
    <ul className="notranslate mt-2 grid gap-1 text-xs text-muted-foreground" translate="no" data-i18n-skip>
      <li>{rate === 0.1 ? tx('Insurance Fee: 10% of the base product price (excluding full set box price).') : tx('Insurance Fee: {0}% of the base product price, based on your membership tier (excluding full set box price).', { 0: String(pct) })}</li>
    </ul>
    {checked && <p className="notranslate mt-2 text-sm font-semibold text-primary" translate="no" data-i18n-skip data-no-translate="" aria-live="polite">{tx('Calculated Insurance Fee: {0}', { 0: formatMoney(fee) })}</p>}
  </fieldset>;
}
