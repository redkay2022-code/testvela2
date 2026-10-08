import { describe, expect, it } from 'vitest';
import { SELLER_WELCOME_TITLE, sellerWelcomeBody, sellerWelcomeCopy } from '@/lib/seller-welcome';

describe('seller welcome message', () => {
  it('uses the requested title', () => expect(SELLER_WELCOME_TITLE).toBe('🎉 Welcome to VELA! 셀러 입점을 축하합니다.'));
  it('lists all declared factories', () => { for (const f of ['VSF', 'ZF', '3KF', 'RC', 'RG', 'UMI', 'Rich', 'Custom']) expect(sellerWelcomeBody('en')).toContain(f); });
  it('includes four rules in each language with the 5% tier discount', () => {
    for (const c of Object.values(sellerWelcomeCopy)) { expect(c.rules).toHaveLength(4); expect(c.rules[3]![1]).toContain('5%'); }
  });
});
