import { describe, expect, it } from 'vitest';
import { availableQty, isCustomerVisible, publishBlockers, resolveProductStatus } from '@/lib/catalog';

describe('catalog rules', () => {
  it('available quantity is stock minus reserved', () => {
    expect(availableQty(5, 2)).toBe(3);
  });
  it('published product with zero available stock becomes out of stock', () => {
    expect(resolveProductStatus('PUBLISHED', 0, 0)).toBe('OUT_OF_STOCK');
    expect(resolveProductStatus('PUBLISHED', 2, 2)).toBe('OUT_OF_STOCK');
  });
  it('restocking an out-of-stock product publishes it again', () => {
    expect(resolveProductStatus('OUT_OF_STOCK', 3, 0)).toBe('PUBLISHED');
  });
  it('drafts stay drafts regardless of stock', () => {
    expect(resolveProductStatus('DRAFT', 0, 0)).toBe('DRAFT');
  });
  it('only published and out-of-stock products are visible to customers', () => {
    expect(isCustomerVisible('PUBLISHED')).toBe(true);
    expect(isCustomerVisible('OUT_OF_STOCK')).toBe(true);
    expect(isCustomerVisible('DRAFT')).toBe(false);
    expect(isCustomerVisible('READY')).toBe(false);
    expect(isCustomerVisible('ARCHIVED')).toBe(false);
  });
  it('publishing requires name, store, category, price, stock and main image', () => {
    expect(publishBlockers({ title: '', storeId: null, category: '', price: null, stock: -1, hasMainImage: false })).toEqual(['상품명', '스토어', '카테고리', '가격', '재고', '대표 이미지']);
    expect(publishBlockers({ title: 'A', storeId: 's', category: '기타', price: 100, stock: 1, hasMainImage: true })).toEqual([]);
  });
});
