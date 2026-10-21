import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { tx } from '@/lib/dom-translate';
import { changeSellerPlan, submitPlanPayment } from '@/lib/seller-accounts.functions';
import { BILLING_PERIODS, YEARLY_DISCOUNT_LABEL, needsPayment, paidPrice, type BillingPeriod, type PlanId } from '@/lib/seller-plans';
import { N, NT, T } from './apply-text';
import { CryptoDepositDialog, type CryptoNetwork } from './crypto-payment';

type KeepItem = { id: string; title: string; price: number | null; created_at: string };
type Pending = { plan: PlanId; billing: BillingPeriod; limit: number; items: KeepItem[] };
type Paying = { plan: 'pro' | 'enterprise'; billing: BillingPeriod };

/** Switch an approved seller to another plan.
 *  - Basic / the first free Pro month: right away. Moving to a lower product limit asks which products stay active; the rest are deactivated.
 *  - Paid plans (Enterprise, or Pro after its free month): the same USDT payment window as the product checkout; the team confirms the transaction afterwards. */
export function useSwitchPlan({ promoUsed, onDone, onError }: { promoUsed: boolean; onDone: (r: { paid: boolean }) => void; onError: (message: string, detail: string) => void }) {
  const change = useServerFn(changeSellerPlan), submitPayment = useServerFn(submitPlanPayment), qc = useQueryClient();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [paying, setPaying] = useState<Paying | null>(null);
  const [network, setNetwork] = useState<CryptoNetwork>('USDT-TRC20');

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['my-account'] });
    await qc.invalidateQueries({ queryKey: ['my-listings'] });
    await qc.invalidateQueries({ queryKey: ['posts'] });
  };

  const free = async (plan: PlanId, billing: BillingPeriod, keepIds?: string[]) => {
    setBusy(plan);
    try {
      const r = await change({ data: { plan, billingPeriod: billing, ...(keepIds ? { keepIds } : {}) } });
      if (!r.ok) {
        if (r.code === 'NEED_KEEP') { setPending({ plan, billing, limit: r.limit, items: r.items }); return; }
        setPending(null); onError(tx('Plan could not be changed.'), `${r.code} · ${r.detail}`); return;
      }
      setPending(null); await refresh(); onDone({ paid: false });
    } catch (e) { setPending(null); onError(e instanceof Error ? tx(e.message) : tx('Something went wrong'), ''); }
    finally { setBusy(null); }
  };

  const paid = async (p: Paying, txid: string) => {
    setPaying(null); setBusy(p.plan);
    try {
      const r = await submitPayment({ data: { plan: p.plan, billingPeriod: p.billing, network, txid } });
      if (!r.ok) { onError(tx('Payment could not be submitted.'), `${r.code} · ${r.detail}`); return; }
      await refresh(); onDone({ paid: true });
    } catch (e) { onError(e instanceof Error ? tx(e.message) : tx('Something went wrong'), ''); }
    finally { setBusy(null); }
  };

  /** Opens the payment window for a paid plan. */
  const pay = (plan: 'pro' | 'enterprise', billing: BillingPeriod) => setPaying({ plan, billing });
  const run = (plan: PlanId, billing: BillingPeriod) => { if (needsPayment(plan, promoUsed)) pay(plan as 'pro' | 'enterprise', billing); else void free(plan, billing); };

  const dialog: ReactNode = <>
    {pending && <KeepProductsDialog key={pending.plan} pending={pending} busy={busy !== null} onCancel={() => setPending(null)} onConfirm={ids => void free(pending.plan, pending.billing, ids)} />}
    {paying && <CryptoDepositDialog network={network} usd={paidPrice(paying.plan, paying.billing)?.total ?? 0} onNetwork={setNetwork} onClose={() => setPaying(null)} onSubmit={txid => void paid(paying, txid)} />}
  </>;
  return { run, pay, busy, dialog };
}

function KeepProductsDialog({ pending, busy, onCancel, onConfirm }: { pending: Pending; busy: boolean; onCancel: () => void; onConfirm: (ids: string[]) => void }) {
  /* the newest products are preselected up to the limit; the seller can change the choice */
  const [chosen, setChosen] = useState<string[]>(() => pending.items.slice(0, pending.limit).map(i => i.id));
  const full = chosen.length >= pending.limit;
  const toggle = (id: string) => setChosen(c => c.includes(id) ? c.filter(x => x !== id) : c.length >= pending.limit ? c : [...c, id]);
  return <div role="dialog" aria-modal="true" aria-label={tx('Choose the products to keep')} className="fixed inset-0 z-[150] grid place-items-center bg-background/80 p-4">
    <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold"><T>Choose the products to keep</T></h3>
      <p className="mt-2 text-sm text-muted-foreground"><NT text="Your new plan allows up to {0} products. Pick the ones to keep active. All others will be deactivated and hidden from buyers; nothing is deleted." tokens={[pending.limit]} /></p>
      <p className={`mt-3 text-sm font-medium ${full ? 'text-primary' : ''}`} role="status"><NT text="{0} / {1} selected" tokens={[chosen.length, pending.limit]} /></p>
      <ul className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
        {pending.items.map(item => {
          const on = chosen.includes(item.id), locked = !on && full;
          return <li key={item.id} className="border-b border-border last:border-b-0">
            <label className={`flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 text-sm ${locked ? 'opacity-50' : ''}`}>
              <input type="checkbox" className="size-4 accent-primary" checked={on} disabled={locked || busy} onChange={() => toggle(item.id)} />
              <span className="min-w-0 flex-1 truncate" data-no-translate translate="no">{item.title || '—'}</span>
              {item.price !== null && <N>{`$${item.price.toLocaleString('en-US')}`}</N>}
            </label>
          </li>;
        })}
      </ul>
      <div className="mt-4 grid gap-2">
        <Button type="button" variant="gold" disabled={busy} onClick={() => onConfirm(chosen)}>{busy ? <T>Submitting…</T> : <T>Confirm and switch plan</T>}</Button>
        <Button type="button" variant="goldOutline" disabled={busy} onClick={onCancel}><T>Cancel</T></Button>
      </div>
    </div>
  </div>;
}

/** Monthly / yearly choice for the paid plans (yearly = 12 months at once with the yearly discount). */
export function BillingToggle({ billing, onBilling, disabled }: { billing: BillingPeriod; onBilling: (b: BillingPeriod) => void; disabled?: boolean }) {
  return <div className="apply-billing" role="group" aria-label={tx('Billing period')}>
    {BILLING_PERIODS.map(b => <button key={b} type="button" aria-pressed={billing === b} disabled={disabled} onClick={() => onBilling(b)}>
      {b === 'monthly' ? <T>Monthly</T> : <NT text="Yearly · {0} off" tokens={[YEARLY_DISCOUNT_LABEL]} />}
    </button>)}
  </div>;
}

