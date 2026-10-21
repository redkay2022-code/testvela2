import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Check, ChevronDown, ShieldCheck } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { tx } from '@/lib/dom-translate';
import { submitSellerApplicationForm } from '@/lib/seller-accounts.functions';
import {
  CATEGORY_OPTIONS, CHANNEL_OPTIONS, COMMISSION_RATE, COUNTRY_CODES, PLANS, PRICE_RANGE_OPTIONS, ROLE_OPTIONS,
  flagOf, sellerApplicationSchema, type PlanId,
} from '@/lib/seller-plans';
import { useCurrency } from './currency';
import { useMyAccount } from './seller-account';
import './seller-apply.css';

/* Translated UI text. The wrapper is marked so the DOM translator never re-translates what the dictionary already produced. */
const frozen = { 'data-i18n-skip': true, 'data-no-translate': true, translate: 'no' as const };
function T({ children }: { children: string }) {
  useCurrency();
  return <span {...frozen} className="notranslate">{tx(children)}</span>;
}
/** Numbers, limits, the fee rate and URLs: never translated, in any language. */
function N({ children }: { children: ReactNode }) {
  return <span translate="no" className="notranslate" data-no-translate>{children}</span>;
}
/** A translated sentence whose {0}, {1} placeholders become untranslated <N> values. */
function NT({ text, tokens }: { text: string; tokens: ReactNode[] }) {
  useCurrency();
  const parts = tx(text).split(/(\{\d\})/);
  return <span {...frozen} className="notranslate">{parts.map((part, i) => { const m = /^\{(\d)\}$/.exec(part); return m ? <N key={i}>{tokens[Number(m[1])]}</N> : part; })}</span>;
}

function useLocaleTag() {
  const { lang } = useCurrency();
  return lang === 'la' ? 'it' : lang;
}

function CountrySelect({ id, value, onChange }: { id: string; value: string; onChange: (code: string) => void }) {
  const tag = useLocaleTag();
  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try { names = new Intl.DisplayNames([tag], { type: 'region' }); } catch { /* old browser: show codes */ }
    return COUNTRY_CODES.map(code => { let name = code; try { name = names?.of(code) ?? code; } catch { /* keep the code */ } return { code, name }; })
      .sort((a, b) => a.name.localeCompare(b.name, tag));
  }, [tag]);
  return <select id={id} className="form-input notranslate" translate="no" data-no-translate value={value} onChange={e => onChange(e.target.value)}>
    <option value="" data-i18n-skip>{tx('Select your country / region')}</option>
    {countries.map(c => <option key={c.code} value={c.code} data-i18n-skip translate="no" className="notranslate">{flagOf(c.code)} {c.name}</option>)}
  </select>;
}

function MultiDropdown({ id, value, onChange, options, placeholder }: { id: string; value: string[]; onChange: (next: string[]) => void; options: readonly (readonly [string, string])[]; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const summary = value.length ? options.filter(o => value.includes(o[0])).map(o => tx(o[1])).join(', ') : tx(placeholder);
  return <div className="apply-multi" ref={box}>
    <button id={id} type="button" className="form-input apply-multi-trigger" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      <span {...frozen} className={value.length ? 'notranslate' : 'notranslate text-muted-foreground'}>{summary}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="apply-multi-panel" role="group" aria-label={tx(placeholder)}>
      {options.map(([key, label]) => <label key={key} className="apply-check">
        <input type="checkbox" checked={value.includes(key)} onChange={() => onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key])} />
        <span {...frozen} className="notranslate">{tx(label)}</span>
      </label>)}
    </div>}
  </div>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <li><span className="apply-plan-label"><T>{label}</T></span><span className="apply-plan-value">{children}</span></li>;
}

function PlanCards({ busy, onSelect }: { busy: PlanId | null; onSelect: (plan: PlanId) => void }) {
  const limit = (n: number | null, text: string) => n === null ? <T>Unlimited</T> : <NT text={text} tokens={[n]} />;
  const pick = (plan: PlanId, label: string, variant: 'gold' | 'goldOutline') => <Button type="button" variant={variant} className="apply-plan-button" disabled={busy !== null} aria-busy={busy === plan} onClick={() => onSelect(plan)}>{busy === plan ? <T>Submitting…</T> : <T>{label}</T>}</Button>;
  return <div className="apply-plans">
    <article className="apply-plan" aria-labelledby="plan-basic">
      <header><h3 id="plan-basic"><T>Basic</T></h3><span className="apply-plan-tag"><T>Free Plan</T></span></header>
      <p className="apply-plan-price"><N>{PLANS.basic.monthlyFee}</N><small><T>per month</T></small></p>
      <ul>
        <Row label="Monthly fee"><N>{PLANS.basic.monthlyFee}</N></Row>
        <Row label="Commission fee"><NT text="{0} per sale" tokens={[COMMISSION_RATE]} /></Row>
        <Row label="Product listing limit">{limit(PLANS.basic.listingLimit, 'Max {0} products')}</Row>
        <Row label="Story content limit">{limit(PLANS.basic.storyLimit, '{0} posts / month')}</Row>
        <Row label="Store URL"><T>Standard profile link</T></Row>
      </ul>
      {pick('basic', 'Select Free Plan', 'goldOutline')}
    </article>

    <article className="apply-plan apply-plan-featured" aria-labelledby="plan-pro">
      <span className="apply-plan-badge"><T>Most Popular</T></span>
      <header><h3 id="plan-pro"><T>Pro Seller</T></h3><span className="apply-plan-tag"><T>Recommended · Launch special</T></span></header>
      <p className="apply-plan-price"><N>{PLANS.pro.monthlyFee}</N><small><T>per month</T></small></p>
      <p className="apply-plan-note"><NT text="Special 3-Month Launch Offer, normally {0}" tokens={[PLANS.pro.regularFee]} /></p>
      <ul>
        <Row label="Monthly fee"><NT text="{0} / month" tokens={[PLANS.pro.monthlyFee]} /></Row>
        <Row label="Commission fee"><NT text="{0} per sale" tokens={[COMMISSION_RATE]} /></Row>
        <Row label="Product listing limit">{limit(PLANS.pro.listingLimit, 'Max {0} products')}</Row>
        <Row label="Story content limit">{limit(PLANS.pro.storyLimit, '{0} posts / month')}</Row>
        <Row label="Dedicated Store URL"><T>Dedicated sub-path URL</T> <NT text="(e.g., {0})" tokens={[PLANS.pro.urlExample]} /></Row>
      </ul>
      {pick('pro', 'Select Pro Plan', 'gold')}
    </article>

    <article className="apply-plan" aria-labelledby="plan-enterprise">
      <header><h3 id="plan-enterprise"><T>Enterprise Partner</T></h3><span className="apply-plan-tag"><T>Review required</T></span></header>
      <p className="apply-plan-price"><N>{PLANS.enterprise.monthlyFee}</N><small><T>per month</T></small></p>
      <ul>
        <Row label="Monthly fee"><NT text="{0} / month" tokens={[PLANS.enterprise.monthlyFee]} /></Row>
        <Row label="Commission fee"><NT text="{0} per sale" tokens={[COMMISSION_RATE]} /></Row>
        <Row label="Product listing limit">{limit(PLANS.enterprise.listingLimit, 'Max {0} products')}</Row>
        <Row label="Story content limit">{limit(PLANS.enterprise.storyLimit, '{0} posts / month')}</Row>
        <Row label="Custom Domain Support"><T>Full custom domain integration</T> <NT text="(e.g., {0})" tokens={[PLANS.enterprise.urlExample]} /></Row>
      </ul>
      {pick('enterprise', 'Apply for Enterprise Review', 'goldOutline')}
    </article>
  </div>;
}

export function SellerApplyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void supabase.auth.getUser().then(r => { setUser(r.data.user); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { setUser(session?.user ?? null); setReady(true); });
    return () => subscription.unsubscribe();
  }, []);
  const nav = useNavigate(), qc = useQueryClient();
  const account = useMyAccount(user);
  const submit = useServerFn(submitSellerApplicationForm);

  const [country, setCountry] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState('');
  const [price, setPrice] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [courier, setCourier] = useState<'yes' | 'no' | ''>('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [done, setDone] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);

  /* Location-aware default: preselect the country from the browser's language region (the user can change it). */
  useEffect(() => {
    if (country) return;
    for (const l of navigator.languages ?? []) {
      let region = ''; try { region = new Intl.Locale(l).region ?? ''; } catch { /* ignore */ }
      if (region && COUNTRY_CODES.includes(region)) { setCountry(region); return; }
    }
  }, [country]);

  const showError = (message: string) => { setErr(message); requestAnimationFrame(() => errRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })); };

  const choose = async (plan: PlanId) => {
    const missing: string[] = [];
    if (!country) missing.push(tx('Country / Region'));
    if (!categories.length) missing.push(tx('Main categories'));
    if (!items.trim()) missing.push(tx('Main sales items'));
    if (!price) missing.push(tx('Average price range'));
    if (!channels.length) missing.push(tx('Existing sales channels'));
    if (!role) missing.push(tx('Business role'));
    if (!courier) missing.push(tx('Contracted courier partner'));
    if (missing.length) return showError(tx('Please complete: {0}', { 0: missing.join(', ') }));
    const parsed = sellerApplicationSchema.safeParse({ country, mainCategories: categories, mainSalesItems: items, avgPriceRange: price, salesChannels: channels, businessRole: role, hasCourier: courier === 'yes', plan });
    if (!parsed.success) return showError(tx('Please check your answers and try again.'));
    setBusy(plan); setErr('');
    try {
      await submit({ data: parsed.data });
      await qc.invalidateQueries({ queryKey: ['my-account'] });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (e) { showError(e instanceof Error ? e.message : tx('Something went wrong')); }
    finally { setBusy(null); }
  };

  const requestAuth = () => void nav({ to: '.', search: (p: any) => ({ ...p, auth: true }) });
  const app = account.data?.application;

  if (!ready || (user && account.isLoading)) return <p className="lux-empty"><T>Loading…</T></p>;
  if (!user) return <section className="apply-page"><div className="seller-flow-card text-center"><span className="lux-eyebrow">SELLER APPLICATION</span>
    <p className="mt-4 text-sm text-muted-foreground"><T>Sign in to apply for a seller account.</T></p>
    <Button variant="gold" className="mt-4" onClick={requestAuth}><T>Sign in</T></Button></div></section>;
  if (done || (app && app.status !== 'rejected')) {
    const approved = !done && app?.status === 'approved';
    return <section className="apply-page"><div className="seller-flow-card text-center">
      <ShieldCheck className="mx-auto text-primary" size={34} aria-hidden="true" />
      <h1 className="mt-3 text-lg font-semibold"><T>{approved ? 'Approved — welcome to Vela' : done ? 'Application submitted' : 'Pending admin review'}</T></h1>
      {!approved && <p className="mt-2 text-sm text-muted-foreground"><T>Our team will review your application. You will be notified once it is decided.</T></p>}
      <Button asChild variant="goldOutline" className="mt-5"><Link to={approved ? '/seller' : '/me'}><T>{approved ? 'Open my studio' : 'Back to my page'}</T></Link></Button>
    </div></section>;
  }

  return <section className="apply-page" aria-labelledby="apply-title">
    <span className="lux-eyebrow">SELLER APPLICATION</span>
    <h1 id="apply-title" className="apply-title"><T>Become a Vela seller</T></h1>
    <p className="apply-lead"><T>Tell us about your business, then choose a plan. Every application is reviewed by our team.</T></p>
    {app?.status === 'rejected' && <p className="mt-3 text-sm text-destructive"><T>Previous application was declined. You may reapply.</T></p>}

    <form className="apply-form" noValidate onSubmit={e => e.preventDefault()}>
      <h2 className="apply-step"><span>1</span><T>About your business</T></h2>

      <label className="form-label" htmlFor="apply-country"><T>Country / Region</T></label>
      <CountrySelect id="apply-country" value={country} onChange={setCountry} />

      <fieldset className="apply-fieldset"><legend className="form-label"><T>Main categories</T></legend>
        <div className="apply-checks">{CATEGORY_OPTIONS.map(([key, label]) => <label key={key} className="apply-check">
          <input type="checkbox" checked={categories.includes(key)} onChange={() => setCategories(c => c.includes(key) ? c.filter(v => v !== key) : [...c, key])} /><T>{label}</T></label>)}</div>
      </fieldset>

      <label className="form-label" htmlFor="apply-items"><T>Main sales items</T></label>
      <input id="apply-items" className="form-input" maxLength={300} value={items} onChange={e => setItems(e.target.value)} placeholder={tx('Brands or products you mainly sell')} />

      <label className="form-label" htmlFor="apply-price"><T>Average price range</T></label>
      <select id="apply-price" className="form-input notranslate" translate="no" data-no-translate value={price} onChange={e => setPrice(e.target.value)}>
        <option value="" data-i18n-skip>{tx('Select a price range')}</option>
        {PRICE_RANGE_OPTIONS.map(([key, text, a, b]) => <option key={key} value={key} data-i18n-skip translate="no" className="notranslate">{tx(text, { 0: a, 1: b })}</option>)}
      </select>

      <label className="form-label" htmlFor="apply-channels"><T>Existing sales channels</T></label>
      <MultiDropdown id="apply-channels" value={channels} onChange={setChannels} options={CHANNEL_OPTIONS} placeholder="Select channels" />

      <fieldset className="apply-fieldset"><legend className="form-label"><T>Business role</T></legend>
        <div className="apply-checks">{ROLE_OPTIONS.map(([key, label]) => <label key={key} className="apply-check">
          <input type="radio" name="apply-role" checked={role === key} onChange={() => setRole(key)} /><T>{label}</T></label>)}</div>
      </fieldset>

      <fieldset className="apply-fieldset"><legend className="form-label"><T>Contracted courier partner</T></legend>
        <div className="apply-checks">{([['yes', 'Yes'], ['no', 'No']] as const).map(([key, label]) => <label key={key} className="apply-check">
          <input type="radio" name="apply-courier" checked={courier === key} onChange={() => setCourier(key)} /><T>{label}</T></label>)}</div>
      </fieldset>

      <h2 className="apply-step mt-10"><span>2</span><T>Choose your plan</T></h2>
      <p className="apply-lead"><NT text="One simple commission: {0} per sale on every plan." tokens={[COMMISSION_RATE]} /></p>
      {err && <p ref={errRef} role="alert" className="apply-error">{err}</p>}
      <PlanCards busy={busy} onSelect={plan => void choose(plan)} />
      <p className="apply-foot"><Check size={14} aria-hidden="true" /><T>Your plan is confirmed after the team approves your application.</T></p>
    </form>
  </section>;
}
