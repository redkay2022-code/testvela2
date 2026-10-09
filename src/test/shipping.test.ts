import { describe, expect, it } from 'vitest';
import { shippingError } from '@/lib/shipping';

const ok = { recipient: 'Kim Duhyun', phone: '+82 10 1234 5678', line1: '1 Main St', line2: 'Apt 3', city: 'Seoul', state: 'Seoul', postal: '04524', country: 'South Korea' };

describe('checkout shipping validation', () => {
  it('accepts complete shipping info', () => expect(shippingError(ok)).toBe(''));
  it('requires every field', () => expect(shippingError({ ...ok, state: ' ' })).not.toBe(''));
  it('rejects Telegram handles as phone', () => expect(shippingError({ ...ok, phone: '@vela' })).not.toBe(''));
});
