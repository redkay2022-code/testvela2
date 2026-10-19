import { AlertTriangle, ShieldCheck } from 'lucide-react';
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
    <div role="status" aria-live="polite" data-insurance-state={checked ? 'covered' : 'declined'} className={`notranslate mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${checked ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`} translate="no" data-i18n-skip data-no-translate="">
      {checked ? <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true"/> : <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true"/>}
      <div className="min-w-0">
        <p className="font-semibold">{checked ? tx('Covered by Shipping & Customs Insurance ({0}% Fee)', { 0: String(pct) }) : tx('Without Insurance')}</p>
        <p className="mt-0.5 leading-relaxed">{checked ? tx('Full coverage for loss, damage, or customs seizure during transit, with guaranteed free reshipment or a full refund.') : tx('The platform and seller are not liable for shipping losses or customs issues if insurance is declined.')}</p>
        {checked && <p className="mt-1 font-semibold">{tx('Calculated Insurance Fee: {0}', { 0: formatMoney(fee) })}</p>}
      </div>
    </div>
  </fieldset>;
}
