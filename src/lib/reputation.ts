export type SellerTier = 'verified' | 'master' | 'sovereign';
export type BuyerTier = 'member' | 'silver' | 'gold' | 'black';
export const ratingCriteria = ['Product Accuracy', 'QC Standard', 'Shipping Speed', 'Service'] as const;
export type SellerReputation = { approved: boolean; ratings: readonly [number, number, number, number] | null; completedSales: number; sample?: boolean };
export const sellerLabels: Record<SellerTier, string> = { verified: 'VELA Verified', master: 'VELA Master', sovereign: 'VELA Crown Sovereign' };
export const buyerLabels: Record<BuyerTier, string> = { member: 'Member', silver: 'Silver Pass', gold: 'Gold VIP', black: 'Black Platinum VVIP' };
export function ratingAverage(reputation: SellerReputation): number | null {
  if (!reputation.ratings) return null;
  return reputation.ratings.reduce((sum, score) => sum + Math.max(0, Math.min(5, score)), 0) / 4;
}
export function sellerTier(reputation: SellerReputation): SellerTier | null {
  if (!reputation.approved) return null;
  const rating = ratingAverage(reputation) ?? 0;
  if (rating >= 4.95 && reputation.completedSales >= 200) return 'sovereign';
  if (rating >= 4.8 && reputation.completedSales >= 50) return 'master';
  return 'verified';
}
export function nextSellerTier(reputation: SellerReputation) {
  const current = sellerTier(reputation);
  if (!current || current === 'sovereign') return null;
  const tier: SellerTier = current === 'verified' ? 'master' : 'sovereign';
  const rating = tier === 'master' ? 4.8 : 4.95;
  const sales = tier === 'master' ? 50 : 200;
  return { tier, rating, sales, ratingProgress: Math.min(100, ((ratingAverage(reputation) ?? 0) / rating) * 100), salesProgress: Math.min(100, (Math.max(0, reputation.completedSales) / sales) * 100) };
}
// Editorial studio reputation is isolated sample data, never a live seller approval.
export const studioReputation: SellerReputation = { approved: true, ratings: [4.94, 4.92, 4.82, 4.92], completedSales: 128, sample: true };
export const unknownReputation: SellerReputation = { approved: false, ratings: null, completedSales: 0 };