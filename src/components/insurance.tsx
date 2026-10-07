import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from '@tanstack/react-router';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/currency';
import { insuredPurchase, insuranceFee, insuranceTiers, nextInsuranceTier, tierForSpend, tierInfo, type InsuranceTier } from '@/lib/insurance';

type Role = 'buyer' | 'seller' | 'admin' | undefined;
/** Sum of the buyer's admin-verified crypto orders (USD equivalent). */
function useVerifiedSpend() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); const { data } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user?.id ?? null)); return () => data.subscription.unsubscribe(); }, []);
  const q = useQuery({ queryKey: ['verified-spend', uid], enabled: !!uid, staleTime: 30_000, queryFn: async () => {
    const { data } = await supabase.from('orders').select('amount_usd').eq('buyer_id', uid!).not('payment_verified_at', 'is', null);
    return (data ?? []).reduce((sum, o) => sum + Number(o.amount_usd ?? 0), 0);
  } });
  return q.data ?? 0;
}
const perkKeys = { bronze: 'perkBronze', silver: 'perkSilver', gold: 'perkGold', platinum: 'perkPlatinum' } as const;

export function InsuranceTeaser({ price, format, role }: { price: number; format: (n: number) => string; role?: Role }) {
  const fee = insuranceFee(price), gold = insuranceFee(price, 'gold');
  return <div className="insurance-card">
    <p><ShieldCheck size={15}/> {t('insuranceFee')}: <strong>{format(fee.base)}</strong> ({t('base10')})</p>
    <Link to="/me" search={{ role }} className="insurance-teaser">{t('goldTeaser',{x:format(gold.final)})} <span>{t('viewBenefits')}<ChevronRight size={13}/></span></Link>
  </div>;
}

export function InsuranceBreakdown({ price, box = 0, format }: { price: number; box?: number; format: (n: number) => string; tier?: InsuranceTier }) {
  const { insurance, total } = insuredPurchase(price, box);
  return <dl className="insurance-breakdown" aria-label="Insurance fee breakdown">
    <div><dt>{t('productPrice')}</dt><dd>{format(price)}</dd></div>
    {box > 0 && <div><dt>{t('fullSetBox')}</dt><dd>+{format(box)}</dd></div>}
    <div><dt>{t('deliveryInsurance')} (+10%)</dt><dd>+{format(insurance)}</dd></div>
    <div className="insurance-total"><dt>{t('total')}</dt><dd>{format(total)}</dd></div>
  </dl>;
}

export function TierBenefits() {
  const spend = useVerifiedSpend();
  const current = tierForSpend(spend), next = nextInsuranceTier(spend);
  const [tab, setTab] = useState<InsuranceTier | null>(null);
  const tier = tierInfo(tab ?? current.id);
  return <section className="tier-benefits" aria-label={t('tierTitle')}>
    <div className="section-heading"><h2>{t('tierTitle')}</h2><span className={`tier-pill tier-${current.id}`}>{current.label}</span></div>
    {next && <div className="tier-next"><div><span>{t('nextTier',{tier:next.tier.label})}</span><span>{t('remaining',{x:formatMoney(next.remaining)})}</span></div><div className="tier-spend">{formatMoney(spend)} / {formatMoney(next.tier.threshold)}</div><progress max={100} value={next.progress} aria-label="Progress to next tier"/></div>}
    <div className="tier-tabs" role="tablist" aria-label={t('tierTitle')}>
      {insuranceTiers.map(ti => <button key={ti.id} type="button" role="tab" aria-selected={tier.id === ti.id} className={`tier-tab${tier.id === ti.id ? ' active' : ''}`} onClick={() => setTab(ti.id)}><span className={`tier-pill tier-${ti.id}`}>{ti.label}</span>{ti.id === current.id && <small>{t('currentTier')}</small>}</button>)}
    </div>
    <div className="tier-tab-panel" role="tabpanel">
      <dl className="tier-tab-facts">
        <div><dt>{t('colReq')}</dt><dd>{tier.threshold ? `${formatMoney(tier.threshold + 1)} ~ ${(() => { const n = insuranceTiers[insuranceTiers.indexOf(tier) + 1]; return n ? formatMoney(n.threshold) : '' })()}` : `${t('basic')} · ${formatMoney(0)} ~ ${formatMoney(insuranceTiers[1].threshold)}`}</dd></div>
        <div><dt>{t('colFee')}</dt><dd>{Math.round(tier.rate * 100)}%{tier.discount ? <small> (-{Math.round(tier.discount * 100)}%)</small> : null}</dd></div>
      </dl>
      <p className="tier-tab-perk">{t(perkKeys[tier.id])}</p>
    </div>
    <p className="tier-note">{t('tierNote')}</p>
  </section>;
}

export function InsuranceBanner({ role }: { role?: Role }) {
  return <Link to="/me" search={{ role }} className="insurance-banner"><ShieldCheck size={18}/><span><strong>{t('bannerStrong')}</strong> {t('bannerText')}</span><ChevronRight size={16}/></Link>;
}
