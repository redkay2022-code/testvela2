import { buyerLabels, nextSellerTier, ratingAverage, ratingCriteria, sellerLabels, sellerTier, type BuyerTier, type SellerReputation, type SellerTier } from '@/lib/reputation';

type Emblem = SellerTier | BuyerTier;
export function LuxuryEmblem({ tier }: { tier: Emblem }) {
  return <svg viewBox="0 0 40 40" className={`luxury-emblem emblem-${tier}`} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {tier === 'verified' ? <><path className="emblem-field" d="m20 3 5 4 7 2 2 11-4 10-10 7-10-7-4-10 2-11 7-2Z"/><path d="m20 7 11 5-2 15-9 6-9-6-2-15Z"/><path d="m13 20 5 5 10-11" strokeWidth="2.4"/><path d="M4 14 2 20l3 8m31-14 2 6-3 8"/></> :
    tier === 'master' ? <><path className="emblem-field" d="M20 3c-8 7-8 12-3 18-5-8-15-8-14-1 1 5 7 6 12 4-3 3-6 4-8 3 1 5 6 6 11 1l2 8 2-8c5 5 10 4 11-1-2 1-5 0-8-3 5 2 11 1 12-4 1-7-9-7-14 1 5-6 5-11-3-18Z"/><path d="M20 8v23M12 24h16M16 30h8M17 36h6"/></> :
    tier === 'sovereign' ? <><path className="emblem-field" d="m20 13 10 10-10 14-10-14Z"/><path d="m4 8 7 5 9-9 9 9 7-5-3 13H7Z"/><path d="m10 23 10 4 10-4M20 13v24M15 18l5 9 5-9M8 18h24"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="3" r="1.5"/><circle cx="36" cy="6" r="1.5"/></> :
    tier === 'member' ? <><path className="emblem-field" d="m20 3 15 9v16l-15 9-15-9V12Z"/><path d="m20 8 11 6v12l-11 6-11-6V14Z"/><path d="m14 16 6 12 6-12"/></> :
    tier === 'silver' ? <><path className="emblem-field" d="m20 3 16 17-16 17L4 20Z"/><path d="m20 9 10 11-10 11-10-11Z"/><path d="m20 14 5 6-5 6-5-6Z"/></> :
    tier === 'gold' ? <><circle className="emblem-field" cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="12.5"/><path d="m20 10 4 6 6 4-6 4-4 6-4-6-6-4 6-4Z"/><path d="m20 16 4 4-4 4-4-4Z"/></> :
    <><path className="emblem-field" d="m20 3 15 9-3 17-12 8-12-8-3-17Z"/><path d="m20 8 10 12-10 13-10-13Z"/><path d="m10 20 10 4 10-4M20 8v25M7 10l5-2m16 0 5 2M9 30l-3-6m25 6 3-6"/><path d="m14 13 6 11 6-11"/></>}
  </svg>;
}
export function SellerBadge({ reputation, compact = false }: { reputation: SellerReputation; compact?: boolean }) {
  const tier = sellerTier(reputation);
  if (!tier) return null;
  const label = sellerLabels[tier];
  return <span className={`reputation-badge seller-badge tier-${tier} ${compact ? 'badge-compact' : ''}`} role="img" aria-label={`${label}${reputation.sample ? ' · Sample reputation' : ''}`} title={`${label}${reputation.sample ? ' · Sample reputation' : ''}`}><LuxuryEmblem tier={tier}/>{!compact && <span>{label}</span>}</span>;
}
export function BuyerBadge({ tier = 'member', compact = false }: { tier?: BuyerTier; compact?: boolean }) {
  return <span className={`reputation-badge buyer-badge tier-${tier} ${compact ? 'badge-compact' : ''}`} role="img" aria-label={buyerLabels[tier]} title={buyerLabels[tier]}><LuxuryEmblem tier={tier}/>{!compact && <span>{buyerLabels[tier]}</span>}</span>;
}
export function SellerRatings({ reputation }: { reputation: SellerReputation }) {
  const average = ratingAverage(reputation), next = nextSellerTier(reputation), tier = sellerTier(reputation);
  return <section className="seller-reputation" aria-label="Seller reputation">
    <div className="reputation-heading"><div><span className="lux-eyebrow">SELLER REPUTATION{reputation.sample ? ' · SAMPLE' : ''}</span><h3>{average === null ? 'Not yet rated' : <><strong>{average.toFixed(2)}</strong><span> / 5.00</span></>}</h3></div><SellerBadge reputation={reputation}/></div>
    <div className="rating-criteria">{ratingCriteria.map((label, i) => <div className="rating-criterion" key={label}><span>{label}</span><progress max={5} value={reputation.ratings?.[i] ?? 0} aria-label={label}/><strong>{reputation.ratings?.[i]?.toFixed(2) ?? '—'}</strong></div>)}</div>
    <div className="tier-progress">
      {next ? <><div className="next-tier-heading"><span>Next distinction</span><span className="reputation-next"><LuxuryEmblem tier={next.tier}/>{sellerLabels[next.tier]}</span></div><div className="tier-progress-row"><span>Rating</span><span>{(average ?? 0).toFixed(2)} / {next.rating.toFixed(2)}</span><progress max={100} value={next.ratingProgress} aria-label="Rating progress to next seller tier"/></div><div className="tier-progress-row"><span>Completed sales</span><span>{reputation.completedSales} / {next.sales}</span><progress max={100} value={next.salesProgress} aria-label="Sales progress to next seller tier"/></div><p>{Math.max(0, next.sales - reputation.completedSales)} more completed sales · {next.rating.toFixed(2)}+ rating required</p></> : <p>{tier === 'sovereign' ? 'Highest distinction achieved' : reputation.approved ? 'Your reputation begins here.' : 'Seller approval pending · No earned tier yet'}</p>}
    </div>
  </section>;
}