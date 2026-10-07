import { describe, expect, it } from 'vitest';
import { nextSellerTier, ratingAverage, sellerTier, type SellerReputation } from '@/lib/reputation';
const rep = (rating: number, sales: number, approved = true): SellerReputation => ({ approved, ratings: [rating, rating, rating, rating], completedSales: sales });
describe('seller reputation', () => {
  it('starts every approved seller at Verified without a warning tier', () => {
    expect(sellerTier(rep(0, 0))).toBe('standard');
    expect(sellerTier(rep(4.99, 300, false))).toBeNull();
  });
  it('requires both Master thresholds', () => {
    expect(sellerTier(rep(4.8, 50))).toBe('master');
    expect(sellerTier(rep(4.79, 50))).toBe('verified');
    expect(sellerTier(rep(4.8, 49))).toBe('verified');
  });
  it('requires both Sovereign thresholds', () => {
    expect(sellerTier(rep(4.95, 200))).toBe('sovereign');
    expect(sellerTier(rep(4.94, 200))).toBe('master');
    expect(sellerTier(rep(4.95, 199))).toBe('master');
  });
  it('uses the unrounded mean of all four criteria', () => {
    const reputation: SellerReputation = { approved: true, ratings: [4.8, 5, 4.7, 4.9], completedSales: 80 };
    expect(ratingAverage(reputation)).toBeCloseTo(4.85);
    expect(sellerTier(rep(4.949, 200))).toBe('master');
  });
  it('tracks both remaining criteria and stops at the top tier', () => {
    expect(nextSellerTier(rep(4.8, 50))).toMatchObject({ tier: 'sovereign', rating: 4.95, sales: 200, salesProgress: 25 });
    expect(nextSellerTier(rep(4.95, 200))).toBeNull();
    expect(nextSellerTier(rep(5, 500, false))).toBeNull();
  });
});