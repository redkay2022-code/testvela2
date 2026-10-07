import { Link } from '@tanstack/react-router';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatMoney, krwToUsd } from '@/lib/currency';
import { insuranceFee, insuranceTiers, nextInsuranceTier, tierForSpend, tierInfo, type InsuranceTier } from '@/lib/insurance';

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

export function InsuranceBreakdown({ price, box = 0, format, tier = 'bronze' }: { price: number; box?: number; format: (n: number) => string; tier?: InsuranceTier }) {
  const baseTotal = price + box, fee = insuranceFee(baseTotal, tier), info = tierInfo(tier);
  return <dl className="insurance-breakdown" aria-label="Insurance fee breakdown">
    <div><dt>{t('productPrice')}</dt><dd>{format(price)}</dd></div>
    {box > 0 && <div><dt>{t('fullSetBox')}</dt><dd>+{format(box)}</dd></div>}
    {box > 0 && <div><dt>{t('baseTotal')}</dt><dd>{format(baseTotal)}</dd></div>}
    <div><dt>{t('insuranceFee')} (+10%)</dt><dd>+{format(fee.base)}</dd></div>
    <div><dt>{t('tierDiscount',{tier:info.label})} (-{Math.round(info.discount * 100)}%)</dt><dd>-{format(fee.discount)}</dd></div>
    <div className="insurance-total"><dt>{t('finalFee')}</dt><dd>{format(fee.final)}</dd></div>
    <div className="insurance-total"><dt>{t('total')}</dt><dd>{format(baseTotal + fee.final)}</dd></div>
  </dl>;
}

export function TierBenefits() {
  const current = tierForSpend(VERIFIED_SPEND), next = nextInsuranceTier(VERIFIED_SPEND);
  return <section className="tier-benefits" aria-label={t('tierTitle')}>
    <div className="section-heading"><h2>{t('tierTitle')}</h2><span className={`tier-pill tier-${current.id}`}>{current.label}</span></div>
    {next && <div className="tier-next"><div><span>{t('nextTier',{tier:next.tier.label})}</span><span>{t('remaining',{x:formatMoney(krwToUsd(next.remaining))})}</span></div><progress max={100} value={next.progress} aria-label="Progress to next tier"/></div>}
    <table className="tier-table"><thead><tr><th>{t('colTier')}</th><th>{t('colReq')}</th><th>{t('colFee')}</th><th>{t('colPerk')}</th></tr></thead><tbody>
      {insuranceTiers.map(tier => <tr key={tier.id} className={tier.id === current.id ? 'current' : ''}><td><span className={`tier-pill tier-${tier.id}`}>{tier.label}</span></td><td>{tier.threshold ? t('over',{x:formatMoney(krwToUsd(tier.threshold))}) : t('basic')}</td><td>{Math.round(tier.rate * 100)}%{tier.discount ? <small> (-{Math.round(tier.discount * 100)}%)</small> : null}</td><td>{t(perkKeys[tier.id])}</td></tr>)}
    </tbody></table>
    <p className="tier-note">{t('tierNote')}</p>
  </section>;
}

export function InsuranceBanner({ role }: { role?: Role }) {
  return <Link to="/me" search={{ role }} className="insurance-banner"><ShieldCheck size={18}/><span><strong>{t('bannerStrong')}</strong> {t('bannerText')}</span><ChevronRight size={16}/></Link>;
}
