import { describe, expect, it } from 'vitest';
import { exceedsPriceCap, MAX_PRODUCT_PRICE_USD } from '@/lib/price-cap';
import { insuranceRateForTier, insuredPurchase } from '@/lib/insurance';

describe('판매 최고가', () => {
  it('최고가는 $3,500', () => expect(MAX_PRODUCT_PRICE_USD).toBe(3500));
  it('정확히 $3,500는 허용', () => expect(exceedsPriceCap(3500, 0)).toBe(false));
  it('$3,500.01은 거절', () => expect(exceedsPriceCap(3500.01, 0)).toBe(true));
  it('박스 금액도 합산', () => expect(exceedsPriceCap(3400, 150)).toBe(true));
});

describe('보험 등급 요율', () => {
  it('브론즈 10% · 실버 7% · 골드 5% · 플래티넘 3%', () => {
    expect(['bronze', 'silver', 'gold', 'platinum'].map(t => insuranceRateForTier(t))).toEqual([0.1, 0.07, 0.05, 0.03]);
  });
  it('등급을 모르면 기본 10%', () => expect(insuranceRateForTier(undefined)).toBe(0.1));
  it('DB 요율이 있으면 우선', () => expect(insuranceRateForTier('gold', { gold: 0.04 })).toBe(0.04));
  it('비정상 요율은 기본 10%', () => expect(insuranceRateForTier('gold', { gold: 0.5 })).toBe(0.1));
  it('보험료는 포인트 할인과 무관하게 판매가 기준', () => expect(insuredPurchase(1000, 0, true, 0.03)).toEqual({ insurance: 30, total: 1030 }));
  it('기존 호출은 10%', () => expect(insuredPurchase(100, 50, true)).toEqual({ insurance: 10, total: 160 }));
});
