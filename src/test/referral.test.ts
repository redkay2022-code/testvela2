import { describe, expect, it } from 'vitest';
import { isReferralCode, normalizeReferral, referralLink } from '@/lib/referral';

describe('referral codes', () => {
  it('accepts 8-character codes (any case) and old user-id links, rejects the rest', () => {
    expect(isReferralCode('ABCD2345')).toBe(true);
    expect(isReferralCode('abcd2345')).toBe(true);
    expect(isReferralCode('11111111-2222-3333-4444-555555555555')).toBe(true);
    expect(isReferralCode('ABCD234')).toBe(false);
    expect(isReferralCode('ABCDI234')).toBe(false);
    expect(isReferralCode('')).toBe(false);
    expect(isReferralCode(null)).toBe(false);
  });
  it('normalizes codes to upper case and ids to lower case', () => {
    expect(normalizeReferral('abcd2345')).toBe('ABCD2345');
    expect(normalizeReferral('AAAAAAAA-0000-0000-0000-00000000000A')).toBe('aaaaaaaa-0000-0000-0000-00000000000a');
  });
  it('builds the share link from the code', () => {
    expect(referralLink('ABCD2345', 'https://velamarket.app')).toBe('https://velamarket.app/ref/ABCD2345');
  });
});
