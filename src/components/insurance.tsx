import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatMoney, krwToUsd } from '@/lib/currency';
import { insuredPurchase, insuranceFee, insuranceTiers, nextInsuranceTier, tierForSpend, tierInfo, type InsuranceTier } from '@/lib/insurance';

type Role = 'buyer' | 'seller' | 'admin' | undefined;
// No trusted spend history exists yet, so every account starts at the BRONZE baseline.
const VERIFIED_SPEND = 0;
const perkKeys = { bronze: 'perkBronze', silver: 'perkSilver', gold: 'perkGold', platinum: 'perkPlatinum', black: 'perkBlack' } as const;

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
  const current = tierForSpend(VERIFIED_SPEND), next = nextInsuranceTier(VERIFIED_SPEND);
  const [tab, setTab] = useState<InsuranceTier>(current.id);
  const tier = tierInfo(tab);
  return <section className="tier-benefits" aria-label={t('tierTitle')}>
    <div className="section-heading"><h2>{t('tierTitle')}</h2><span className={`tier-pill tier-${current.id}`}>{current.label}</span></div>
    {next && <div className="tier-next"><div><span>{t('nextTier',{tier:next.tier.label})}</span><span>{t('remaining',{x:formatMoney(krwToUsd(next.remaining))})}</span></div><progress max={100} value={next.progress} aria-label="Progress to next tier"/></div>}
    <div className="tier-tabs" role="tablist" aria-label={t('tierTitle')}>
      {insuranceTiers.map(ti => <button key={ti.id} type="button" role="tab" aria-selected={tab === ti.id} className={`tier-tab${tab === ti.id ? ' active' : ''}`} onClick={() => setTab(ti.id)}><span className={`tier-pill tier-${ti.id}`}>{ti.label}</span>{ti.id === current.id && <small>{t('currentTier')}</small>}</button>)}
    </div>
    <div className="tier-tab-panel" role="tabpanel">
      <dl className="tier-tab-facts">
        <div><dt>{t('colReq')}</dt><dd>{tier.threshold ? t('over',{x:formatMoney(krwToUsd(tier.threshold))}) : t('basic')}</dd></div>
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
