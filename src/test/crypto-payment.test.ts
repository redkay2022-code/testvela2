import { describe, it, expect } from 'vitest';
import { toUnits, erc20TransferData } from '@/components/crypto-payment';
describe('USDT amounts', () => {
  it('converts 6-decimal USDT', () => expect(toUnits('123.45', 6)).toBe('123450000'));
  it('converts 18-decimal BEP-20 USDT', () => expect(toUnits('1.50', 18)).toBe('1500000000000000000'));
  it('encodes transfer calldata', () => expect(erc20TransferData('0x' + 'a'.repeat(40), '1')).toBe('0xa9059cbb' + '0'.repeat(24) + 'a'.repeat(40) + '0'.repeat(63) + '1'));
});
import { moonpayUrl } from '@/components/crypto-payment';
describe('MoonPay link', () => {
  it('prefills TRC-20 USDT, amount and wallet', () => {
    const u = new URL(moonpayUrl(10000, 'TDmP3UVG9QZkWGWzSKrGJWh8wz9kdGEb6E'));
    expect(u.searchParams.get('currencyCode')).toBe('usdt_trx');
    expect(u.searchParams.get('baseCurrencyAmount')).toBe('10000.00');
    expect(u.searchParams.get('walletAddress')).toBe('TDmP3UVG9QZkWGWzSKrGJWh8wz9kdGEb6E');
  });
});
import { trustTitle, trustPillars } from '@/components/crypto-payment';
describe('Payment trust banner', () => {
  const all = [trustTitle, ...trustPillars.map(p => p.join(' '))].join(' ').toLowerCase();
  it('shows the buyer-first title and exactly three guarantees', () => {
    expect(trustTitle).toBe('🛡️ VELA Customer Safety First Payment System');
    expect(trustPillars.map(p => p[0])).toEqual([
      '🔒 100% Privacy & Financial Data Protection',
      '💎 Scam Protection & 100% Escrow Guarantee',
      '🌐 Secure USDT Crypto Settlement',
    ]);
    trustPillars.forEach(p => expect(p[1].length).toBeGreaterThan(40));
  });
  it('promises escrow release only after the buyer receives, inspects and approves', () => {
    const escrow = trustPillars.find(p => p[0].includes('Escrow'))?.[1] ?? '';
    expect(escrow).toMatch(/released to the seller only after you receive, inspect, and approve/i);
    expect(escrow).toMatch(/full refund protection/i);
    expect(trustPillars.find(p => p[0].includes('Privacy'))?.[1]).toMatch(/never stores your credit card, bank, or personal financial details/i);
  });
  it('makes no anonymity, KYC-free or surveillance/tax-evasion promise', () => {
    ['anonym', 'surveillance', 'tax', 'customs', 'track', 'untraceable', 'avoid', 'kyc', 'no identity'].forEach(banned => {
      expect(all).not.toContain(banned);
    });
  });
});
