import { describe, expect, it } from 'vitest';
import { shippingError } from '@/lib/shipping';

const ok = { recipient: 'Kim Duhyun', phone: '+44 7911 123456', line1: '1 Main St', line2: 'Apt 3', city: 'London', state: 'London', postal: 'SW1A 1AA', country: 'United Kingdom' };

describe('checkout shipping validation', () => {
  it('accepts complete shipping info', () => expect(shippingError(ok)).toBe(''));
  it('requires every field', () => expect(shippingError({ ...ok, state: ' ' })).not.toBe(''));
  it('rejects Telegram handles as phone', () => expect(shippingError({ ...ok, phone: '@vela' })).not.toBe(''));
});
