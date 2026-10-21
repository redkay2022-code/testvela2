import { describe, expect, it } from 'vitest';
import { BILLING_PERIODS, COMMISSION_RATE, COUNTRY_CODES, INSTANT_PLANS, PLANS, PRO_PROMO_MONTHS, flagOf, formatUsd, listingLimitOf, needsPayment, paidPrice, paymentDue, planChangeSchema, planDowngrade, planPaymentSchema, promoEnded, sellerApplicationSchema } from '@/lib/seller-plans';

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

describe('plan change', () => {
  it('basic and pro switch right away, enterprise needs a review; unknown plans are rejected', () => {
    expect([...INSTANT_PLANS]).toEqual(['basic', 'pro']);
    expect(planChangeSchema.safeParse({ plan: 'enterprise' }).success).toBe(true);
    expect(planChangeSchema.safeParse({ plan: 'gold' }).success).toBe(false);
  });
  it('plan cards carry no store URL text any more', () => {
    for (const p of Object.values(PLANS)) expect('urlExample' in p).toBe(false);
  });
});

describe('launch offer and billing period', () => {
  it('Pro is free for the first month only', () => {
    expect(PRO_PROMO_MONTHS).toBe(1);
    expect(PLANS.pro.regularFee).toBe('$49');
  });
  it('monthly price is the regular price; yearly is 12 months with 10% off', () => {
    expect(paidPrice('pro', 'monthly')).toEqual({ monthly: 49, total: 49, perMonth: 49, unit: 'month' });
    expect(paidPrice('pro', 'yearly')).toEqual({ monthly: 49, total: 529.2, perMonth: 44.1, unit: 'year' });
    expect(paidPrice('enterprise', 'yearly')?.total).toBe(2149.2);
    expect(paidPrice('basic', 'yearly')).toBeNull();
    expect(formatUsd(529.2)).toBe('$529.20');
    expect(formatUsd(2149.2)).toBe('$2,149.20');
    expect(formatUsd(49)).toBe('$49');
  });
  it('the billing period defaults to monthly and only accepts monthly / yearly', () => {
    expect([...BILLING_PERIODS]).toEqual(['monthly', 'yearly']);
    expect(sellerApplicationSchema.parse({ ...valid, plan: 'pro' }).billingPeriod).toBe('monthly');
    expect(sellerApplicationSchema.parse({ ...valid, plan: 'pro', billingPeriod: 'yearly' }).billingPeriod).toBe('yearly');
    expect(sellerApplicationSchema.safeParse({ ...valid, billingPeriod: 'weekly' }).success).toBe(false);
  });
  it('a plan change can carry the products to keep (uuids only)', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    expect(planChangeSchema.parse({ plan: 'basic', keepIds: [id] }).keepIds).toEqual([id]);
    expect(planChangeSchema.safeParse({ plan: 'basic', keepIds: ['nope'] }).success).toBe(false);
    expect(planChangeSchema.parse({ plan: 'pro' }).billingPeriod).toBe('monthly');
  });
  it('the end-of-free-month popup shows only for Pro sellers whose free period is over and who have not chosen yet', () => {
    const now = Date.parse('2026-11-01T00:00:00Z'), past = '2026-10-20T00:00:00Z', future = '2026-12-01T00:00:00Z';
    expect(promoEnded({ plan: 'pro', promo_ends_at: past }, now)).toBe(true);
    expect(promoEnded({ plan: 'pro', promo_ends_at: future }, now)).toBe(false);
    expect(promoEnded({ plan: 'pro', promo_ends_at: past, payment_status: 'pending' }, now)).toBe(false);
    expect(promoEnded({ plan: 'pro', promo_ends_at: past, payment_status: 'paid' }, now)).toBe(false);
    expect(promoEnded({ plan: 'basic', promo_ends_at: past }, now)).toBe(false);
    expect(promoEnded({ plan: 'pro', promo_ends_at: null }, now)).toBe(false);
    expect(promoEnded(null, now)).toBe(false);
  });
});

describe('downgrade: choose which products stay active', () => {
  const ids = Array.from({ length: 14 }, (_, i) => `p${i}`);
  it('needs nothing when the products fit the new limit, or the new plan is unlimited', () => {
    expect(planDowngrade(ids.slice(0, 10), 10)).toEqual({ kind: 'ok' });
    expect(planDowngrade(ids, Number.POSITIVE_INFINITY)).toEqual({ kind: 'ok' });
  });
  it('asks the seller to choose when there are too many products', () => {
    expect(planDowngrade(ids, 10)).toEqual({ kind: 'need_keep' });
  });
  it('deactivates exactly the products that were not kept', () => {
    const keep = ids.slice(0, 10);
    expect(planDowngrade(ids, 10, keep)).toEqual({ kind: 'drop', drop: ids.slice(10) });
    expect(planDowngrade(ids, 10, ids.slice(0, 3))).toEqual({ kind: 'drop', drop: ids.slice(3) });
  });
  it('rejects keeping more than the limit, or products the seller does not own', () => {
    expect(planDowngrade(ids, 10, ids.slice(0, 11))).toEqual({ kind: 'invalid' });
    expect(planDowngrade(ids, 10, ['p1', 'someone-elses'])).toEqual({ kind: 'invalid' });
  });
});

describe('paying for a plan in the shared payment window', () => {
  const pay = { plan: 'pro', billingPeriod: 'yearly', network: 'USDT-TRC20', txid: '0x' + 'a'.repeat(64) };
  it('accepts Pro and Enterprise payments, with or without a TXID', () => {
    expect(planPaymentSchema.safeParse(pay).success).toBe(true);
    expect(planPaymentSchema.safeParse({ ...pay, plan: 'enterprise', txid: '' }).success).toBe(true);
  });
  it('rejects Basic, unknown networks and malformed TXIDs', () => {
    expect(planPaymentSchema.safeParse({ ...pay, plan: 'basic' }).success).toBe(false);
    expect(planPaymentSchema.safeParse({ ...pay, network: 'USDT-SOLANA' }).success).toBe(false);
    expect(planPaymentSchema.safeParse({ ...pay, txid: 'short' }).success).toBe(false);
    expect(planPaymentSchema.safeParse({ ...pay, txid: 'x'.repeat(130) }).success).toBe(false);
  });
  it('Enterprise always needs a payment; Pro only after its free month was used; Basic never', () => {
    expect(needsPayment('enterprise', false)).toBe(true);
    expect(needsPayment('pro', false)).toBe(false);
    expect(needsPayment('pro', true)).toBe(true);
    expect(needsPayment('basic', true)).toBe(false);
  });
  it('the choose-and-pay popup also appears for an approved Enterprise seller who has not paid', () => {
    const now = Date.parse('2026-11-01T00:00:00Z'), past = '2026-10-20T00:00:00Z';
    expect(paymentDue({ plan: 'pro', promo_ends_at: past }, now)).toBe(true);
    expect(paymentDue({ plan: 'enterprise', promo_ends_at: null }, now)).toBe(true);
    expect(paymentDue({ plan: 'enterprise', payment_status: 'pending' }, now)).toBe(false);
    expect(paymentDue({ plan: 'enterprise', payment_status: 'paid' }, now)).toBe(false);
    expect(paymentDue({ plan: 'pro', promo_ends_at: past, requested_plan: 'enterprise' }, now)).toBe(false);
    expect(paymentDue({ plan: 'pro', promo_ends_at: '2026-12-01T00:00:00Z' }, now)).toBe(false);
    expect(paymentDue({ plan: 'basic' }, now)).toBe(false);
  });
});
