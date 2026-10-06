import { describe,expect,it } from 'vitest';
import { marketSearch,pageHead } from '@/lib/market';
import { priceLabel } from '@/lib/market-media';

describe('velamarket URL state',() => {
  it('preserves nested detail and sign-in states',() => {
    expect(marketSearch.parse({post:'daily-bag',auth:true,category:'패션'})).toEqual({post:'daily-bag',auth:true,category:'패션'});
  });
  it('rejects unknown tabs',() => {
    expect(marketSearch.safeParse({tab:'unsafe'}).success).toBe(false);
  });
  it('gives each page specific social metadata',() => {
    const head=pageHead('취향 마켓','취향이 담긴 물건');
    expect(head.meta).toContainEqual({property:'og:title',content:'취향 마켓 · velamarket'});
  });
  it('formats marketplace prices',() => {
    expect(priceLabel(89000)).toBe('89,000원');
  });
});