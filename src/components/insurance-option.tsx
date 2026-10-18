import { ShieldCheck } from 'lucide-react';
import { tx } from '@/lib/dom-translate';
import { insuranceFeeFor } from '@/lib/insurance-option';

/** Optional shipping & customs insurance for a product upload (English source strings; translated through the i18n dictionary). */
export function InsuranceOption({ price, checked, onChange }: { price: number | string; checked: boolean; onChange: (next: boolean) => void }) {
  const fee = insuranceFeeFor(price);
  return <fieldset className="notranslate mt-5 rounded-lg border border-border p-3" translate="no" data-no-translate="">
    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
      <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={e => onChange(e.target.checked)}/>
      <ShieldCheck size={17} aria-hidden="true"/>
      <span className="notranslate" translate="no" data-i18n-skip>{tx('Shipping & Customs Insurance')}</span>
    </label>
    <ul className="notranslate mt-2 grid gap-1 text-xs text-muted-foreground" translate="no" data-i18n-skip>
      <li>{tx('Insurance Fee: 10% of the base product price (excluding full set box price).')}</li>
      <li>{tx('Insured: Seller takes 100% full responsibility for shipping loss, damage, or customs clearance issues (guaranteed reshipment or full refund).')}</li>
      <li>{tx('Uninsured: Seller is NOT responsible for any transit loss, damage, or customs issues.')}</li>
    </ul>
    {checked && <p className="notranslate mt-2 text-sm font-semibold text-primary" translate="no" data-i18n-skip data-no-translate="" aria-live="polite">{tx('Calculated Insurance Fee: {0}', { 0: `$${fee.toFixed(2)}` })}</p>}
  </fieldset>;
}
