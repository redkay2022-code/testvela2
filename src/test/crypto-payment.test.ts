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
