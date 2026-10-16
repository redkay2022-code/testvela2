import { describe, expect, it } from 'vitest';
import { matchesProductQuery } from '@/lib/product-search';
import { mixSellers } from '@/lib/feed-ranking';
import type { LuxuryPost } from '@/lib/luxury-market';

const mk = (o: Record<string, unknown>) => ({ title: '', description: '', creator: '', factory: '', category: '', price: null, boxPrice: null, source: { specs: {} }, ...o }) as unknown as LuxuryPost;
const rolex = mk({ title: 'Rolex Oyster Perpetual 41 124300 Green', description: '绿色表盘 904L钢 自动机芯', factory: 'VS Factory (VSF)', price: 3150, source: { specs: { brand: 'Rolex', material: 'Oystersteel', movement: '3235 Automatic' } } });

describe('product search', () => {
  it('searches title, description, factory, specs and price', () => {
    for (const q of ['rolex', 'oyster', '904L', 'VSF', '3235', '3150', 'green perpetual']) expect(matchesProductQuery(rolex, q)).toBe(true);
    expect(matchesProductQuery(rolex, 'cartier')).toBe(false);
  });
  it('finds the same product in other languages', () => {
    for (const q of ['롤렉스', '劳力士', 'ロレックス', 'Ролекс', 'رولكس', '초록', 'grün', 'vert', '스틸', '오토매틱']) expect(matchesProductQuery(rolex, q)).toBe(true);
  });
  it('does not match unrelated listings through short equivalents', () => {
    const plain = mk({ title: 'Factory strap during spring' });
    expect(matchesProductQuery(plain, 'gold')).toBe(false);
    expect(matchesProductQuery(plain, '반지')).toBe(false);
  });
  it('an empty search matches everything', () => expect(matchesProductQuery(rolex, '  ')).toBe(true));
});

describe('mixing sellers in the video feed', () => {
  const v = (id: string, seller: string) => mk({ id, creator: seller, sample: true });
  it('keeps the order but avoids the same seller back to back', () => {
    const out = mixSellers([v('a1', 'A'), v('a2', 'A'), v('a3', 'A'), v('b1', 'B'), v('c1', 'C')]).map(p => p.id);
    expect(out.slice(0, 3)).toEqual(['a1', 'b1', 'c1']);
    expect(new Set(out)).toEqual(new Set(['a1', 'a2', 'a3', 'b1', 'c1']));
  });
});
