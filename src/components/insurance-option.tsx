import { ShieldCheck } from 'lucide-react';
import { tx } from '@/lib/dom-translate';
import { insuranceFeeFor } from '@/lib/insurance-option';
import { formatMoney } from '@/lib/currency';

/** Optional buyer insurance; seller item price only, excluding the box. */
export function InsuranceOption({ price, checked, onChange }: { price: number | string; checked: boolean; onChange: (next: boolean) => void }) {
  const fee = insuranceFeeFor(price);
  return <fieldset className="notranslate mt-5 rounded-lg border border-border p-3" translate="no" data-no-translate="">
    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
      <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={e => onChange(e.target.checked)}/>
      <ShieldCheck size={17} aria-hidden="true"/>
      <span className="notranslate min-w-0 flex-1" translate="no" data-i18n-skip>{tx('Shipping & Customs Insurance')}</span>
      <strong className="shrink-0 text-primary" data-i18n-skip>+{formatMoney(fee)}</strong>
    </label>
    <ul className="notranslate mt-2 grid gap-1 text-xs text-muted-foreground" translate="no" data-i18n-skip>
      <li>{tx('Insurance Fee: 10% of the base product price (excluding full set box price).')}</li>
    </ul>
    {checked && <p className="notranslate mt-2 text-sm font-semibold text-primary" translate="no" data-i18n-skip data-no-translate="" aria-live="polite">{tx('Calculated Insurance Fee: {0}', { 0: formatMoney(fee) })}</p>}
  </fieldset>;
}
