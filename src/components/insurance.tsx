import { Link } from '@tanstack/react-router';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { insuranceFee, insuranceTiers, nextInsuranceTier, tierForSpend, tierInfo, won, type InsuranceTier } from '@/lib/insurance';

type Role = 'buyer' | 'seller' | 'admin' | undefined;
// No trusted spend history exists yet, so every account starts at the BRONZE baseline.
const VERIFIED_SPEND = 0;

export function InsuranceTeaser({ price, format, role }: { price: number; format: (n: number) => string; role?: Role }) {
  const fee = insuranceFee(price), gold = insuranceFee(price, 'gold');
  return <div className="insurance-card">
    <p><ShieldCheck size={15}/> 안심 거래 보험료: <strong>{format(fee.base)}</strong> (기본 10%)</p>
    <Link to="/me" search={{ role }} className="insurance-teaser">GOLD 등급 달성 시 {format(gold.final)} (50% 할인) <span>혜택 보기<ChevronRight size={13}/></span></Link>
  </div>;
}

export function InsuranceBreakdown({ price, box = 0, format, tier = 'bronze' }: { price: number; box?: number; format: (n: number) => string; tier?: InsuranceTier }) {
  const baseTotal = price + box, fee = insuranceFee(baseTotal, tier), info = tierInfo(tier);
  return <dl className="insurance-breakdown" aria-label="Insurance fee breakdown">
    <div><dt>상품 금액</dt><dd>{format(price)}</dd></div>
    {box > 0 && <div><dt>풀셋 박스</dt><dd>+{format(box)}</dd></div>}
    {box > 0 && <div><dt>기본 합계</dt><dd>{format(baseTotal)}</dd></div>}
    <div><dt>안심 거래 보험료 (+10%)</dt><dd>+{format(fee.base)}</dd></div>
    <div><dt>{info.label} 등급 할인 (-{Math.round(info.discount * 100)}%)</dt><dd>-{format(fee.discount)}</dd></div>
    <div className="insurance-total"><dt>최종 보험료</dt><dd>{format(fee.final)}</dd></div>
    <div className="insurance-total"><dt>합계</dt><dd>{format(baseTotal + fee.final)}</dd></div>
  </dl>;
}

export function TierBenefits() {
  const current = tierForSpend(VERIFIED_SPEND), next = nextInsuranceTier(VERIFIED_SPEND);
  return <section className="tier-benefits" aria-label="VIP 등급 및 혜택">
    <div className="section-heading"><h2>VIP 등급 및 혜택</h2><span className={`tier-pill tier-${current.id}`}>{current.label}</span></div>
    {next && <div className="tier-next"><div><span>다음 등급 {next.tier.label}</span><span>{won(next.remaining)} 남음</span></div><progress max={100} value={next.progress} aria-label="Progress to next tier"/></div>}
    <table className="tier-table"><thead><tr><th>등급</th><th>조건</th><th>보험료</th><th>혜택</th></tr></thead><tbody>
      {insuranceTiers.map(t => <tr key={t.id} className={t.id === current.id ? 'current' : ''}><td><span className={`tier-pill tier-${t.id}`}>{t.label}</span></td><td>{t.threshold ? `${won(t.threshold)} 초과` : '기본'}</td><td>{Math.round(t.rate * 100)}%{t.discount ? <small> (-{Math.round(t.discount * 100)}%)</small> : null}</td><td>{t.perk}</td></tr>)}
    </tbody></table>
    <p className="tier-note">기본 보험료 10%: 100% 정품 보증, 분실·파손 보험, 4K QC 포함. 등급은 확인된 구매 금액 기준이며 현재 결제 연동 전으로 모든 계정은 BRONZE입니다.</p>
  </section>;
}

export function InsuranceBanner({ role }: { role?: Role }) {
  return <Link to="/me" search={{ role }} className="insurance-banner"><ShieldCheck size={18}/><span><strong>최대 90% 안심 보험료 할인!</strong> VELA 등급별 혜택 보기</span><ChevronRight size={16}/></Link>;
}
