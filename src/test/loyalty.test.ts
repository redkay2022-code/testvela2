import { describe, expect, it } from 'vitest';
import { cashPayment, clampRedeem, earnPoints, formatPointsUsd, maxRedeemPoints, pointsAfterRefund, pointsToUsd } from '@/lib/loyalty';

describe('VELA points', () => {
  it('1P equals $0.001', () => { expect(pointsToUsd(20_000)).toBe(20); expect(pointsToUsd(100_000)).toBe(100); });
  it('shows points with USD', () => expect(formatPointsUsd(20_000)).toBe('20,000 P ($20.00)'));
  it('GOLD earns 2% of a $1,000 product as 20,000P', () => expect(earnPoints(1000, 0.02)).toBe(20_000));
  it('PLATINUM earns 3%', () => expect(earnPoints(1000, 0.03)).toBe(30_000));
  it('redemption is capped at 20% of the product amount', () => expect(maxRedeemPoints(1000, 999_999)).toBe(200_000));
  it('redemption is capped by available balance', () => expect(maxRedeemPoints(1000, 50_000)).toBe(50_000));
  it('requests above the cap are clamped', () => expect(clampRedeem(300_000, 1000, 999_999)).toBe(200_000));
  it('negative requests become zero', () => expect(clampRedeem(-5, 1000, 50_000)).toBe(0));
  it('at least 80% stays cash', () => expect(cashPayment(1000, maxRedeemPoints(1000, 1e9))).toBe(800));
  it('$20 off a $1,000 order leaves $980 cash', () => expect(cashPayment(1000, 20_000)).toBe(980));
  it('a $500 partial refund halves earned points', () => expect(pointsAfterRefund(20_000, 1000, 500)).toBe(10_000));
  it('a full refund removes all earned points', () => expect(pointsAfterRefund(20_000, 1000, 1000)).toBe(0));
});
