import { StudioTierBadge } from './reputation';
import { nextSellerTier, sellerTier, sellerTiers, studioNames, tierRules, ratingAverage, type SellerReputation } from '@/lib/reputation';
import type { RatingStats } from '@/lib/studio-metrics';
import type { RecentReview } from '@/lib/studio-tier';
import { formatMoney } from '@/lib/currency';

export function StudioTierDetails({ reputation }: { reputation: SellerReputation }) {
  const tier = sellerTier(reputation) ?? 'standard', next = nextSellerTier(reputation), average = ratingAverage(reputation);
  const goals = next ? [
    { label: '누적 매출', value: `${formatMoney(reputation.volumeUsd ?? 0, 'USD')} / ${formatMoney(next.volume, 'USD')} 초과`, progress: next.volumeProgress },
    { label: '완료 주문', value: `${reputation.completedSales} / ${next.sales}건`, progress: next.salesProgress },
    { label: '평점', value: `${average?.toFixed(2) ?? '평가 없음'} / ${next.rating.toFixed(1)}점`, progress: next.ratingProgress },
    { label: '분쟁률', value: `${(reputation.disputeRate ?? 0).toFixed(1)}% / ${next.rule.maxDispute}% 미만`, progress: (reputation.disputeRate ?? 0) < next.rule.maxDispute ? 100 : 0 },
  ] : [];
  return <div className="studio-tier-details"><div className="flex flex-wrap items-center justify-between gap-2"><h2>스튜디오 등급 현황</h2><span className="text-xs text-primary">수수료 {tierRules[tier].fee}% · {tierRules[tier].boost}</span></div>
    {next ? <><h3 className="text-sm text-muted-foreground">다음 등급 <span className="text-primary">{studioNames[next.tier]}</span></h3><div className="studio-goals">{goals.map(g => <div key={g.label}><div><span>{g.label}</span><strong>{g.value}</strong></div><progress max={100} value={g.progress} aria-label={`${g.label} 등급 진행률`}/></div>)}</div></> : <p className="text-sm text-primary">최고 등급을 달성했습니다.</p>}
    <div className="studio-tier-table-wrap"><table className="studio-tier-table"><caption className="sr-only">스튜디오 등급 조건과 수수료</caption><thead><tr><th>등급</th><th>누적 매출</th><th>완료 주문</th><th>평점</th><th>분쟁률</th><th>수수료</th><th>노출 혜택</th></tr></thead><tbody>{sellerTiers.map(t => { const r = tierRules[t]; return <tr key={t} className={t === tier ? 'current' : ''}><td><StudioTierBadge tier={t}/></td><td>{t === 'standard' ? '$0+' : `${formatMoney(r.volume, 'USD')} 초과`}</td><td>{t === 'standard' ? '—' : `${r.sales}건 이상`}</td><td>{t === 'standard' ? '—' : `${r.rating.toFixed(1)} 이상`}</td><td>{t === 'standard' ? '—' : `${r.maxDispute}% 미만`}</td><td>{r.fee}%</td><td>{r.boost}</td></tr>; })}</tbody></table></div>
  </div>;
}

export function StudioReviews({ stats, recent, error }: { stats?: RatingStats | undefined; recent?: RecentReview[] | undefined; error: boolean }) {
  if (error) return <p role="alert" className="text-sm text-destructive">고객 리뷰를 불러오지 못했습니다.</p>;
  if (!stats) return <p className="seller-empty">고객 리뷰를 불러오는 중…</p>;
  return <div className="studio-review-details"><h2>고객 리뷰 <span className="text-sm text-muted-foreground">{`${stats.count}개`}</span></h2><div className="studio-review-summary"><div><strong>{stats.average?.toFixed(2) ?? '—'}</strong><span className="text-primary">★ 평균 평점</span></div><div className="rating-breakdown">{[5, 4, 3, 2, 1].map(n => <div key={n}><span>{n}★</span><progress max={Math.max(1, stats.count)} value={stats.breakdown[n - 1] ?? 0} aria-label={`${n}점 리뷰`}/><span>{stats.breakdown[n - 1] ?? 0}</span></div>)}</div></div><h3 className="text-sm font-semibold">최근 구매 고객 리뷰</h3>{recent?.length ? recent.map(r => <article className="studio-recent-review" key={r.id}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm">{r.nickname}</span><span className="text-xs text-primary">{r.rating ? `★ ${r.rating.toFixed(1)}` : '별점 없음'}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{r.body}</p><time className="mt-2 block text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('ko-KR')}</time></article>) : <p className="seller-empty">아직 고객 리뷰가 없습니다.</p>}</div>;
}