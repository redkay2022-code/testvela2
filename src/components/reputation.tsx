import { automatedTier, buyerLabels, nextSellerTier, ratingAverage, ratingCriteria, sellerLabels, sellerTier, sellerTiers, studioNames, tierRules, type BuyerTier, type SellerReputation, type SellerTier } from '@/lib/reputation';
import type { RatingStats } from '@/lib/studio-metrics';
import type { RecentReview } from '@/lib/studio-tier';

type Emblem = BuyerTier;
export function LuxuryEmblem({ tier }: { tier: Emblem }) {
  return <svg viewBox="0 0 40 40" className={`luxury-emblem emblem-${tier}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {tier === 'member' ? <><path className="emblem-field" d="m20 3 15 9v16l-15 9-15-9V12Z"/><path d="m20 8 11 6v12l-11 6-11-6V14Z"/><path d="m14 16 6 12 6-12"/></> :
    tier === 'silver' ? <><path className="emblem-field" d="m20 3 16 17-16 17L4 20Z"/><path d="m20 9 10 11-10 11-10-11Z"/><path d="m20 14 5 6-5 6-5-6Z"/></> :
    tier === 'gold' ? <><circle className="emblem-field" cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="12.5"/><path d="m20 10 4 6 6 4-6 4-4 6-4-6-6-4 6-4Z"/><path d="m20 16 4 4-4 4-4-4Z"/></> :
    <><path className="emblem-field" d="m20 3 15 9-3 17-12 8-12-8-3-17Z"/><path d="m20 8 10 12-10 13-10-13Z"/><path d="m10 20 10 4 10-4M20 8v25M7 10l5-2m16 0 5 2M9 30l-3-6m25 6 3-6"/><path d="m14 13 6 11 6-11"/></>}
  </svg>;
}
export function StudioEmblem({ tier }: { tier: SellerTier }) {
  return <svg viewBox="0 0 40 40" className={`luxury-emblem studio-emblem studio-emblem-${tier}`} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {tier === 'standard' ? <><path className="emblem-field" d="m20 3 15 9v16l-15 9-15-9V12Z"/><path d="m14 20 4 4 8-9" strokeWidth="2.2"/></> :
    tier === 'pro' ? <><path className="emblem-field" d="m20 3 16 17-16 17L4 20Z"/><path d="m20 9 10 11-10 11-10-11Z"/><path d="m15 20 4 4 7-8" strokeWidth="2"/></> :
    tier === 'prime' ? <><circle className="emblem-field" cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="12"/><path d="m20 10 3 6.5 7 1-5 5 1.2 7L20 26l-6.2 3.5 1.2-7-5-5 7-1Z"/></> :
    <><path className="emblem-field" d="m20 13 10 10-10 14-10-14Z"/><path d="m4 8 7 5 9-9 9 9 7-5-3 13H7Z"/><path d="m10 23 10 4 10-4M20 13v24"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="3" r="1.5"/><circle cx="36" cy="6" r="1.5"/></>}
  </svg>;
}
export function StudioTierBadge({ tier, compact = false, sample = false }: { tier: SellerTier; compact?: boolean; sample?: boolean }) {
  const label = sellerLabels[tier], title = `${studioNames[tier]}${sample ? ' · Sample' : ''}`;
  return <span className={`reputation-badge seller-badge studio-${tier} ${compact ? 'badge-compact' : ''}`} role="img" aria-label={title} title={title} data-no-translate><StudioEmblem tier={tier}/>{!compact && <span>{label}</span>}</span>;
}
export function SellerBadge({ reputation, compact = false, withRating = false }: { reputation: SellerReputation; compact?: boolean; withRating?: boolean }) {
  const tier = sellerTier(reputation);
  if (!tier) return null;
  if (!withRating) return <StudioTierBadge tier={tier} compact={compact} sample={!!reputation.sample}/>;
  const avg = ratingAverage(reputation), count = reputation.ratingCount;
  return <span className="studio-badge-line" data-no-translate><span className={`reputation-badge seller-badge studio-${tier}`} role="img" aria-label={studioNames[tier]}><StudioEmblem tier={tier}/><span>{studioNames[tier]}</span></span><span className="studio-rating" aria-label="평균 평점">★ {avg === null ? '—' : avg.toFixed(1)}{count !== undefined ? ` (${count})` : ''}</span></span>;
}
export function BuyerBadge({ tier = 'member', compact = false }: { tier?: BuyerTier; compact?: boolean }) {
  return <span className={`reputation-badge buyer-badge tier-${tier} ${compact ? 'badge-compact' : ''}`} role="img" aria-label={buyerLabels[tier]} title={buyerLabels[tier]}><LuxuryEmblem tier={tier}/>{!compact && <span>{buyerLabels[tier]}</span>}</span>;
}
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export function SellerRatings({ reputation }: { reputation: SellerReputation }) {
  const average = ratingAverage(reputation), next = nextSellerTier(reputation), tier = sellerTier(reputation);
  return <section className="seller-reputation" aria-label="Seller reputation">
    <div className="reputation-heading"><div><span className="lux-eyebrow">STUDIO REPUTATION{reputation.sample ? ' · SAMPLE' : ''}</span><h3>{average === null ? 'Not yet rated' : <><strong>{average.toFixed(2)}</strong><span> / 5.00</span></>}</h3></div><SellerBadge reputation={reputation}/></div>
    {reputation.ratings && <div className="rating-criteria">{ratingCriteria.map((label, i) => <div className="rating-criterion" key={label}><span>{label}</span><progress max={5} value={reputation.ratings?.[i] ?? 0} aria-label={label}/><strong>{reputation.ratings?.[i]?.toFixed(2) ?? '—'}</strong></div>)}</div>}
    <div className="tier-progress">
      {next ? <><div className="next-tier-heading"><span>Next tier</span><span className="reputation-next"><StudioEmblem tier={next.tier}/>{studioNames[next.tier]}</span></div><div className="tier-progress-row"><span>Escrowed sales</span><span>{usd(reputation.volumeUsd ?? 0)} / {usd(next.volume)}</span><progress max={100} value={next.volumeProgress} aria-label="Sales volume progress"/></div><div className="tier-progress-row"><span>Completed orders</span><span>{reputation.completedSales} / {next.sales}</span><progress max={100} value={next.salesProgress} aria-label="Completed orders progress"/></div></> : <p>{tier === 'master' ? 'Highest studio tier achieved' : reputation.approved ? 'Your reputation begins here.' : 'Seller approval pending · No earned tier yet'}</p>}
    </div>
  </section>;
}
/** Seller Center "Studio Tier" tab: current tier, metrics, progress and comparison. */
export function StudioTierPanel({ reputation, live, stats, recent }: { reputation: SellerReputation; live: boolean; stats?: RatingStats | undefined; recent?: RecentReview[] | undefined }) {
  const tier = sellerTier(reputation) ?? 'standard', auto = automatedTier(reputation) ?? 'standard', next = nextSellerTier(reputation), average = ratingAverage(reputation);
  return <section className="studio-tier-panel" aria-label="등급 및 혜택">
    <div className="studio-tier-hero"><StudioTierBadge tier={tier}/><div><span className="lux-eyebrow">CURRENT TIER{live ? '' : ' · SAMPLE'}</span><h2>{studioNames[tier]}</h2><p>수수료 {tierRules[tier].fee}% · {tierRules[tier].boost}{reputation.override && reputation.override !== auto ? ' · 관리자 지정 등급' : ''}</p></div></div>
    <div className="studio-tier-metrics">
      <div><span>누적 에스크로 매출</span><strong>{usd(reputation.volumeUsd ?? 0)}</strong></div>
      <div><span>완료 주문</span><strong>{reputation.completedSales}</strong></div>
      <div><span>평점</span><strong>{average === null ? '—' : average.toFixed(2)}</strong></div>
      <div><span>분쟁률</span><strong>{(reputation.disputeRate ?? 0).toFixed(1)}%</strong></div>
    </div>
    {next ? <div className="studio-tier-progress">
      <div className="flex items-center justify-between gap-2 text-sm"><span>다음 등급 <strong className="text-primary">{studioNames[next.tier]}</strong></span><span className="text-xs text-muted-foreground">{usd(reputation.volumeUsd ?? 0)} / {usd(next.volume)}</span></div>
      <progress max={100} value={next.volumeProgress} aria-label="다음 등급까지 매출 진행률"/>
      <ul className="studio-tier-checks">
        <li className={(reputation.volumeUsd ?? 0) > next.volume ? 'met' : ''}>{`매출 ${usd(next.volume)} 초과 · 남은 금액 ${usd(Math.max(0, next.volume - (reputation.volumeUsd ?? 0)))}`}</li>
        <li className={reputation.completedSales >= next.sales ? 'met' : ''}>{`완료 주문 ${next.sales}건 이상 · 현재 ${reputation.completedSales}건`}</li>
        <li className={(average ?? 0) >= next.rating ? 'met' : ''}>{average === null ? `평점 ${next.rating.toFixed(1)} 이상 · 현재 평가 없음` : `평점 ${next.rating.toFixed(1)} 이상 · 현재 ${average.toFixed(2)}`}</li>
        <li className={(reputation.disputeRate ?? 0) < next.rule.maxDispute ? 'met' : ''}>{`분쟁률 ${next.rule.maxDispute}% 미만 · 현재 ${(reputation.disputeRate ?? 0).toFixed(1)}%`}</li>
      </ul>
    </div> : <p className="studio-tier-progress text-sm text-primary">최고 등급 MASTER STUDIO를 달성했습니다.</p>}
    {next && next.rating > 0 && <div className="studio-tier-progress"><div className="flex items-center justify-between text-sm"><span>평점 목표 <strong className="text-primary">{next.rating.toFixed(1)}</strong></span><span className="text-xs text-muted-foreground">{average === null ? '평가 없음' : average.toFixed(2)} / {next.rating.toFixed(1)}</span></div><progress max={100} value={next.ratingProgress} aria-label="다음 등급까지 평점 진행률"/></div>}
    <div className="studio-tier-progress"><div className="flex items-center justify-between text-sm"><span>평균 평점 <strong className="text-primary">★ {average === null ? '—' : average.toFixed(2)}</strong></span><span className="text-xs text-muted-foreground">{`리뷰 ${stats?.count ?? reputation.ratingCount ?? 0}개 · 별점 합계 ÷ 리뷰 수`}</span></div>
      {stats && <div className="rating-breakdown">{[5, 4, 3, 2, 1].map(n => { const c = stats.breakdown[n - 1]!; return <div key={n}><span>{n}★</span><progress max={Math.max(1, stats.count)} value={c} aria-label={`${n}점 리뷰`}/><span>{c}</span></div>; })}</div>}
    </div>
    {recent && <div className="studio-tier-progress"><h3 className="text-sm font-semibold">최근 고객 리뷰</h3>{recent.length ? recent.map(r => <div key={r.id} className="border-t border-border pt-2 text-xs"><div className="flex justify-between"><span data-no-translate>{r.nickname}</span><span className="text-primary">{r.rating ? '★'.repeat(r.rating) : '별점 없음'}</span></div><p className="mt-1 line-clamp-2 text-muted-foreground">{r.body}</p></div>) : <p className="text-xs text-muted-foreground">아직 리뷰가 없습니다.</p>}</div>}
    <div className="studio-tier-table-wrap"><table className="studio-tier-table">
      <thead><tr><th>등급</th><th>누적 매출</th><th>완료 주문</th><th>평점</th><th>분쟁률</th><th>수수료</th><th>노출 혜택</th></tr></thead>
      <tbody>{sellerTiers.map(t => { const r = tierRules[t]; return <tr key={t} className={t === tier ? 'current' : ''}><td><StudioTierBadge tier={t}/></td><td>{t === 'standard' ? '$0+' : `${usd(r.volume)} 초과`}</td><td>{t === 'standard' ? '—' : `${r.sales}+`}</td><td>{t === 'standard' ? '—' : `${r.rating.toFixed(1)}+`}</td><td>{t === 'standard' ? '—' : `<${r.maxDispute}%`}</td><td>{r.fee}%</td><td>{r.boost}</td></tr>; })}</tbody>
    </table></div>
  </section>;
}
