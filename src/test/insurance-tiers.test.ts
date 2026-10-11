import { describe, expect, it } from 'vitest';
import { BASE_FEE_RATE, insuranceTiers } from '@/lib/insurance';

// Buyer tier benefits are insurance-rate discounts only — no shipping perks.
const SHIPPING_WORDS = ['배송', '무료', 'shipping', 'ship ', 'delivery', 'Auslandsversand', 'verzending', 'livraison', 'spedizione', 'доставк', 'vectura', 'شحن'];

describe('buyer tier benefits', () => {
  it('lists only insurance discounts, never free shipping', () => {
    for (const tier of insuranceTiers) {
      for (const word of SHIPPING_WORDS) {
        expect(tier.perk.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
    expect(insuranceTiers.map((t) => t.perk)).toEqual(['기본 등급', '보험료 30% 할인', '보험료 50% 할인', '보험료 70% 할인']);
  });

  it('keeps each tier discount equal to the insurance rate reduction', () => {
    for (const tier of insuranceTiers) {
      expect(tier.discount).toBeCloseTo(1 - tier.rate / BASE_FEE_RATE, 10);
    }
  });
});
