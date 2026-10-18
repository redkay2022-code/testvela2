import { describe, expect, it } from 'vitest';
import { canEditStoreContent, isLogisticsOrder } from '@/lib/store-content';
describe('seller storefront ownership', () => {
  it('only owning seller writes notices and introduction', () => {
    expect(canEditStoreContent('seller-a', 'seller-a', ['seller'])).toBe(true);
    expect(canEditStoreContent('seller-b', 'seller-a', ['seller'])).toBe(false);
    expect(canEditStoreContent('buyer', 'buyer', ['user'])).toBe(false);
    expect(canEditStoreContent('admin', 'seller-a', ['admin'])).toBe(false);
    expect(canEditStoreContent(undefined, 'seller-a', [])).toBe(false);
  });
  it('logistics excludes completed and cancelled orders', () => {
    expect(isLogisticsOrder({ stage: 'qc' })).toBe(true);
    expect(isLogisticsOrder({ stage: 'shipped' })).toBe(true);
    expect(isLogisticsOrder({ stage: 'delivered' })).toBe(false);
    expect(isLogisticsOrder({ stage: 'placed', cancelled_at: '2026-10-18' })).toBe(false);
  });
});