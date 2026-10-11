import { describe, expect, it } from 'vitest';
import { nextSellerTier, sellerTier, type SellerReputation } from '@/lib/reputation';
import { metricsFromOrders } from '@/lib/studio-metrics';
const rep = (volumeUsd: number, sales: number, rating: number, disputeRate: number, approved = true): SellerReputation => ({ approved, ratings: [rating, rating, rating, rating], completedSales: sales, volumeUsd, disputeRate });
describe('studio tiers', () => {
  it('starts approved sellers at STANDARD and hides unapproved', () => {
    expect(sellerTier(rep(0, 0, 0, 0))).toBe('standard');
    expect(sellerTier(rep(1e6, 999, 5, 0, false))).toBeNull();
  });
  it('requires every threshold', () => {
    expect(sellerTier(rep(10001, 10, 4.5, 2.9))).toBe('pro');
    expect(sellerTier(rep(10000, 10, 4.5, 0))).toBe('standard');
    expect(sellerTier(rep(50001, 50, 4.8, 0.9))).toBe('prime');
    expect(sellerTier(rep(50001, 50, 4.8, 1))).toBe('pro');
    expect(sellerTier(rep(150001, 150, 4.9, 0.4))).toBe('master');
  });
  it('honours admin override and tracks progress', () => {
    expect(sellerTier({ ...rep(0, 0, 0, 0), override: 'prime' })).toBe('prime');
    expect(nextSellerTier(rep(5000, 5, 4, 0))).toMatchObject({ tier: 'pro', volumeProgress: 50 });
    expect(nextSellerTier(rep(200000, 200, 5, 0))).toBeNull();
  });
  it('derives metrics from delivered orders', () => {
    const m = metricsFromOrders([{ seller_id: 'a', amount_usd: '100', stage: 'delivered', dispute_opened_at: null }, { seller_id: 'a', amount_usd: 50, stage: 'shipped', dispute_opened_at: 'x' }]);
    expect(m).toMatchObject({ volumeUsd: 100, completedSales: 1, disputes: 1, disputeRate: 50 });
  });
});
import { liveReputation, ratingStats } from '@/lib/studio-metrics';
describe('order ratings', () => {
  it('averages ratings and drops tier when rating falls', () => {
    const s = ratingStats([5, 4, 5, null]);
    expect(s.average).toBeCloseTo(14 / 3); expect(s.count).toBe(3);
    const m = { volumeUsd: 20000, completedSales: 20, totalOrders: 20, disputes: 0, disputeRate: 0 };
    expect(sellerTier(liveReputation(m, null, ratingStats([5, 5, 4])))).toBe('pro');
    expect(sellerTier(liveReputation(m, null, ratingStats([5, 4, 4])))).toBe('standard');
  });
});
