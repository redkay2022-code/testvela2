import { describe, expect, it } from 'vitest';
import { insuredPurchase } from '@/lib/insurance';
import { insuranceFeeFor } from '@/lib/insurance-option';

describe('optional purchase insurance', () => {
  it('charges exactly 10% of the seller selling price when selected', () => {
    expect(insuredPurchase(5, 0, true)).toEqual({ insurance: 0.5, total: 5.5 });
    expect(insuranceFeeFor(5)).toBe(0.5);
  });
  it('excludes the full set box from the insurance base', () => {
    expect(insuredPurchase(100, 50, true)).toEqual({ insurance: 10, total: 160 });
  });
  it('charges no insurance when unchecked, even with a box', () => {
    expect(insuredPurchase(100, 50, false)).toEqual({ insurance: 0, total: 150 });
  });
  it('rounds the fixed rate to cents', () => {
    expect(insuredPurchase(12.34, 50, true)).toEqual({ insurance: 1.23, total: 63.57 });
  });
});