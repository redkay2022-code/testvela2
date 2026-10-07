export type SellerTier = 'standard' | 'pro' | 'prime' | 'master';
export type BuyerTier = 'member' | 'silver' | 'gold' | 'black';
export const ratingCriteria = ['Product Accuracy', 'QC Standard', 'Shipping Speed', 'Service'] as const;
/** volumeUsd = completed escrowed sales in USD; disputeRate = percent of orders disputed (0-100). */
export type SellerReputation = { approved: boolean; ratings: readonly [number, number, number, number] | null; completedSales: number; volumeUsd?: number; disputeRate?: number; override?: SellerTier | null; ratingAvg?: number | null; ratingCount?: number; sample?: boolean };
export const sellerTiers: readonly SellerTier[] = ['standard', 'pro', 'prime', 'master'];
export const sellerLabels: Record<SellerTier, string> = { standard: 'STANDARD', pro: 'PRO', prime: 'PRIME', master: 'MASTER' };
export const studioNames: Record<SellerTier, string> = { standard: 'STANDARD STUDIO', pro: 'PRO STUDIO', prime: 'PRIME STUDIO', master: 'MASTER STUDIO' };
export const buyerLabels: Record<BuyerTier, string> = { member: 'Member', silver: 'Silver Pass', gold: 'Gold VIP', black: 'Platinum' };
export type TierRule = { volume: number; sales: number; rating: number; maxDispute: number; fee: number; boost: string };
export const tierRules: Record<SellerTier, TierRule> = {
  standard: { volume: 0, sales: 0, rating: 0, maxDispute: 100, fee: 10, boost: '기본 노출' },
  pro: { volume: 10000, sales: 10, rating: 4.5, maxDispute: 3, fee: 10, boost: '우선 노출' },
  prime: { volume: 50000, sales: 50, rating: 4.8, maxDispute: 1, fee: 8, boost: '최상단 노출' },
  master: { volume: 150000, sales: 150, rating: 4.9, maxDispute: 0.5, fee: 5, boost: '메인 배너 하이라이트' },
};
export function ratingAverage(reputation: SellerReputation): number | null {
  if (reputation.ratingAvg !== undefined) return reputation.ratingAvg;
  if (!reputation.ratings) return null;
  return reputation.ratings.reduce((sum, score) => sum + Math.max(0, Math.min(5, score)), 0) / 4;
}
export function meetsTier(reputation: SellerReputation, tier: SellerTier): boolean {
  const r = tierRules[tier];
  if (tier === 'standard') return true;
  const volume = reputation.volumeUsd ?? 0, dispute = reputation.disputeRate ?? 0, rating = ratingAverage(reputation) ?? 0;
  return volume > r.volume && reputation.completedSales >= r.sales && rating >= r.rating && dispute < r.maxDispute;
}
/** Automated tier from the thresholds, ignoring any admin override. */
export function automatedTier(reputation: SellerReputation): SellerTier | null {
  if (!reputation.approved) return null;
  return [...sellerTiers].reverse().find(t => meetsTier(reputation, t)) ?? 'standard';
}
export function sellerTier(reputation: SellerReputation): SellerTier | null {
  if (!reputation.approved) return null;
  return reputation.override ?? automatedTier(reputation);
}
export function nextSellerTier(reputation: SellerReputation) {
  const current = sellerTier(reputation);
  if (!current || current === 'master') return null;
  const tier = sellerTiers[sellerTiers.indexOf(current) + 1]!;
  const r = tierRules[tier], cur = tierRules[current];
  const volume = reputation.volumeUsd ?? 0;
  const span = Math.max(1, r.volume - cur.volume);
  return { tier, rule: r, rating: r.rating, sales: r.sales, volume: r.volume,
    volumeProgress: Math.max(0, Math.min(100, ((volume - cur.volume) / span) * 100)),
    salesProgress: Math.min(100, (Math.max(0, reputation.completedSales) / r.sales) * 100),
    ratingProgress: Math.min(100, ((ratingAverage(reputation) ?? 0) / r.rating) * 100) };
}
// Editorial studio reputation is isolated sample data, never a live seller approval.
export const studioReputation: SellerReputation = { approved: true, ratings: [4.94, 4.92, 4.82, 4.92], completedSales: 128, volumeUsd: 62400, disputeRate: 0.6, sample: true };
export const launchReputation: SellerReputation = { approved: true, ratings: null, completedSales: 0, volumeUsd: 0, disputeRate: 0, sample: true };
export const unknownReputation: SellerReputation = { approved: false, ratings: null, completedSales: 0 };
