import { describe, expect, it } from 'vitest';
import { canViewTransaction, isActiveTransaction, sampleTransaction, verificationStatus } from '@/lib/order-verification';
describe('order verification and access', () => {
  it('changes pending verification to confirmed only with verified payment', () => {
    expect(verificationStatus({ payment_verified_at: null })).toBe('PENDING_VERIFICATION');
    expect(verificationStatus({ payment_verified_at: '2026-10-18T08:11:00Z' })).toBe('CONFIRMED');
  });
  it('admin sees orders across parties', () => expect(canViewTransaction('admin', 'admin', sampleTransaction)).toBe(true));
  it('seller sees only own store orders', () => { expect(canViewTransaction('seller', 'sample-valee-time', sampleTransaction)).toBe(true); expect(canViewTransaction('seller', 'other', sampleTransaction)).toBe(false); });
  it('buyer sees only their orders', () => { expect(canViewTransaction('buyer', 'sample-buyer-66', sampleTransaction)).toBe(true); expect(canViewTransaction('buyer', 'other', sampleTransaction)).toBe(false); });
  it('active excludes cancelled and completed orders', () => { expect(isActiveTransaction(sampleTransaction)).toBe(true); expect(isActiveTransaction({ ...sampleTransaction, stage: 'delivered' })).toBe(false); expect(isActiveTransaction({ ...sampleTransaction, cancelled_at: '2026-10-18' })).toBe(false); });
  it('requested sample remains separate with exact amount and identities', () => { expect(sampleTransaction.amount_usd).toBe(5.5); expect(sampleTransaction.network).toBe('USDT-TRC20'); expect(sampleTransaction.buyer_name).toBe('구매자 66'); expect(sampleTransaction.seller_name).toBe('Valee&Time'); expect(sampleTransaction.order_no).toBe('VM-35FAFF34'); });
});