import { describe, it, expect } from 'vitest';
import { marketSearch } from '@/lib/market';
describe('Shorts navigation',()=>{
 it('retains the video beneath product and comment sheets',()=>{
  expect(marketSearch.parse({shorts:'linen-day',shortSheet:'product',role:'buyer'})).toMatchObject({shorts:'linen-day',shortSheet:'product',role:'buyer'});
  expect(marketSearch.parse({shorts:'linen-day',shortSheet:'comments'}).shorts).toBe('linen-day');
 });
 it('rejects unsupported Shorts sheets',()=>expect(marketSearch.safeParse({shortSheet:'admin'}).success).toBe(false));
 it('preserves the player when a shopping overlay is opened',()=>expect(marketSearch.parse({shorts:'tulips',shortSheet:'product',panel:'checkout'}).shorts).toBe('tulips'));
});
