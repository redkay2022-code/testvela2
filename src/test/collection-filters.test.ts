import { describe,it,expect } from 'vitest';
import { matchesCollection } from '../lib/collection-filters';
import { seedPosts } from '../lib/seed-sellers';
import { formatMoney } from '../lib/currency';
import { marketSearch } from '../lib/market';
describe('production menu collections',()=>{
 it('separates accessory samples from watch samples',()=>{
  expect(seedPosts.filter(p=>matchesCollection(p,'accessories'))).toHaveLength(6);
  expect(seedPosts.filter(p=>matchesCollection(p,'watches'))).toHaveLength(20);
 });
 it('filters chronographs without classifying accessories as watches',()=>{
  const posts=seedPosts.filter(p=>matchesCollection(p,'watches','chronograph'));
  expect(posts.length).toBeGreaterThan(0);
  expect(posts.every(p=>p.title.includes('Daytona'))).toBe(true);
 });
 it('validates menu filters and wishlist state',()=>{
  expect(marketSearch.parse({collection:'watches',watchType:'diver',panel:'wishlist'}).panel).toBe('wishlist');
  expect(()=>marketSearch.parse({watchType:'unknown'})).toThrow();
 });
 it('labels USDT as an approximate display without changing USD',()=>{
  expect(formatMoney(380,'USDT')).toBe('≈ 380.00 USDT');
  expect(formatMoney(380,'USD')).toBe('$380.00');
 });
});