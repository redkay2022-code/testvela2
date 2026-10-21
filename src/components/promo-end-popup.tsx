import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { tx } from '@/lib/dom-translate';
import { YEARLY_DISCOUNT_LABEL, formatUsd, paidPrice, paymentDue, promoEnded, type BillingPeriod, type PlanId } from '@/lib/seller-plans';
import { NT, T } from './apply-text';
import { BillingToggle, useSwitchPlan } from './plan-switch';

type App = { plan?: string | null; promo_ends_at?: string | null; payment_status?: string | null; requested_plan?: string | null } | null | undefined;
const CHOICES: readonly PlanId[] = ['pro', 'enterprise', 'basic'];
const NAMES: Record<PlanId, string> = { basic: 'Basic', pro: 'Pro Seller', enterprise: 'Enterprise Partner' };

/** Shown to a seller whose free Pro month is over (or whose approved Enterprise plan is not paid yet):
 *  continue with Pro or Enterprise Partner (monthly / yearly, paid in the same USDT window as a product) or switch to Basic (free). */
export function PromoEndPopup({ app }: { app: App }) {
  const [plan, setPlan] = useState<PlanId>(app?.plan === 'enterprise' ? 'enterprise' : 'pro');
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [thanks, setThanks] = useState(false), [err, setErr] = useState('');
  const sw = useSwitchPlan({ promoUsed: true, onDone: r => { setErr(''); if (r.paid) setThanks(true); }, onError: (message, why) => setErr(why ? `${message} (${why})` : message) });
  const due = paymentDue(app), trial = promoEnded(app);
  if (!due && !thanks) return <>{sw.dialog}</>;
  const paid = plan !== 'basic', busy = sw.busy !== null;

  return <>
    <div role="alertdialog" aria-modal="true" aria-label={tx(trial ? 'Your free launch month has ended' : 'Complete your plan payment')} className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5">
        {thanks ? <>
          <h3 className="text-base font-semibold"><T>Thank you!</T></h3>
          <p className="mt-2 text-sm text-muted-foreground"><T>Payment submitted. Our team will confirm it shortly. Your current plan stays active until then.</T></p>
          <Button type="button" variant="gold" className="mt-4 w-full" onClick={() => setThanks(false)}><T>Close</T></Button>
        </> : <>
          <h3 className="text-base font-semibold"><T>{trial ? 'Your free launch month has ended' : 'Complete your plan payment'}</T></h3>
          <p className="mt-2 text-sm text-muted-foreground"><T>Choose how to continue: pick a paid plan, or switch to Basic (free).</T></p>
          <div role="radiogroup" aria-label={tx('Select a plan')} className="mt-4 grid gap-2">
            {CHOICES.map(id => {
              const price = paidPrice(id, billing);
              return <label key={id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${plan === id ? 'border-primary' : 'border-border'}`}>
                <input type="radio" name="promo-plan" className="size-4 accent-primary" checked={plan === id} disabled={busy} onChange={() => setPlan(id)} />
                <span className="font-medium"><T>{NAMES[id]}</T></span>
                <span className="ml-auto text-right">{price ? <NT text={price.unit === 'year' ? '{0} / year' : '{0} / month'} tokens={[formatUsd(price.total)]} /> : <T>Free Plan</T>}</span>
              </label>;
            })}
          </div>
          {paid && <>
            <div className="mt-3"><BillingToggle billing={billing} onBilling={setBilling} disabled={busy} /></div>
            {billing === 'yearly' && <p className="mt-2 text-xs text-primary"><NT text="{0} off compared with monthly billing" tokens={[YEARLY_DISCOUNT_LABEL]} /></p>}
            <p className="mt-2 text-xs text-muted-foreground"><T>The plan starts after our team confirms your payment.</T></p>
          </>}
          {err && <p role="alert" className="mt-3 text-sm text-destructive" data-no-translate>{err}</p>}
          <Button type="button" variant="gold" className="mt-4 w-full" disabled={busy} onClick={() => { setErr(''); sw.run(plan, billing); }}>
            {busy ? <T>Submitting…</T> : paid ? <T>Continue to payment</T> : <T>Switch to Basic (free)</T>}
          </Button>
        </>}
      </div>
    </div>
    {sw.dialog}
  </>;
}
