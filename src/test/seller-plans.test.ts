import { describe, expect, it } from 'vitest';
import { COMMISSION_RATE, COUNTRY_CODES, PLANS, flagOf, listingLimitOf, sellerApplicationSchema } from '@/lib/seller-plans';

const valid = { country: 'KR', mainCategories: ['watches'], mainSalesItems: 'Rolex, custom straps', avgPriceRange: 'under_500', salesChannels: ['instagram'], businessRole: 'creator_customizer', hasCourier: true, plan: 'basic' };

describe('seller plans', () => {
  it('uses one commission rate and the 10 / 35 / unlimited listing limits', () => {
    expect(COMMISSION_RATE).toBe('9.8%');
    expect([PLANS.basic.listingLimit, PLANS.pro.listingLimit, PLANS.enterprise.listingLimit]).toEqual([10, 35, null]);
    expect(PLANS.pro.monthlyFee).toBe('$0');
    expect(PLANS.pro.regularFee).toBe('$49');
    expect(PLANS.enterprise.monthlyFee).toBe('$199');
  });
  it('turns a plan into a numeric listing limit (unlimited = Infinity, unknown = basic)', () => {
    expect(listingLimitOf('basic')).toBe(10);
    expect(listingLimitOf('pro')).toBe(35);
    expect(listingLimitOf('enterprise')).toBe(Number.POSITIVE_INFINITY);
    expect(listingLimitOf(undefined)).toBe(10);
    expect(listingLimitOf('nope')).toBe(10);
  });
});

describe('seller application schema', () => {
  it('accepts a complete application for every plan', () => {
    for (const plan of ['basic', 'pro', 'enterprise']) expect(sellerApplicationSchema.safeParse({ ...valid, plan }).success).toBe(true);
  });
  it('rejects missing or unknown answers', () => {
    expect(sellerApplicationSchema.safeParse({ ...valid, mainCategories: [] }).success).toBe(false);
    expect(sellerApplicationSchema.safeParse({ ...valid, salesChannels: [] }).success).toBe(false);
    expect(sellerApplicationSchema.safeParse({ ...valid, mainSalesItems: '   ' }).success).toBe(false);
    expect(sellerApplicationSchema.safeParse({ ...valid, avgPriceRange: 'free' }).success).toBe(false);
    expect(sellerApplicationSchema.safeParse({ ...valid, businessRole: 'hacker' }).success).toBe(false);
    expect(sellerApplicationSchema.safeParse({ ...valid, plan: 'gold' }).success).toBe(false);
    expect(sellerApplicationSchema.safeParse({ ...valid, country: 'Korea' }).success).toBe(false);
    expect(sellerApplicationSchema.safeParse({ ...valid, hasCourier: undefined }).success).toBe(false);
  });
});

describe('country list', () => {
  it('has unique ISO codes and flags', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.every(c => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(flagOf('kr')).toBe('🇰🇷');
  });
});
