import { describe, it, expect } from 'vitest';
import { marketSearch } from '@/lib/market';
describe('Shorts navigation',()=>{
 it('isolates Shorts tabs from Home and preserves nested search',()=>{
  expect(marketSearch.parse({shortTab:'following',tab:'discover',searchOpen:true,shortSheet:'product'})).toMatchObject({shortTab:'following',tab:'discover',searchOpen:true,shortSheet:'product'});
  expect(marketSearch.safeParse({shortTab:'nearby'}).success).toBe(false);
 });
 it('keeps Home sub-tabs in validated address state',()=>{
  expect(marketSearch.parse({feedTopic:'videos',tab:'discover'})).toMatchObject({feedTopic:'videos',tab:'discover'});
  expect(marketSearch.parse({feedTopic:'PPF',category:'PPF'}).category).toBe('PPF');
  expect(marketSearch.safeParse({feedTopic:'unsupported'}).success).toBe(false);
 });
 it('retains the video beneath product and comment sheets',()=>{
  expect(marketSearch.parse({shorts:'linen-day',shortSheet:'product',role:'buyer'})).toMatchObject({shorts:'linen-day',shortSheet:'product',role:'buyer'});
  expect(marketSearch.parse({shorts:'linen-day',shortSheet:'comments'}).shorts).toBe('linen-day');
 });
 it('rejects unsupported Shorts sheets',()=>expect(marketSearch.safeParse({shortSheet:'admin'}).success).toBe(false));
 it('preserves the player when a shopping overlay is opened',()=>expect(marketSearch.parse({shorts:'tulips',shortSheet:'product',panel:'checkout'}).shorts).toBe('tulips'));
  it('retains the sheet beneath all 15 inspection photos',()=>{
   expect(marketSearch.parse({shorts:'linen-day',shortSheet:'product',shortPhoto:14})).toMatchObject({shorts:'linen-day',shortSheet:'product',shortPhoto:14});
   for(const shortPhoto of [-1,15,1.5])expect(marketSearch.safeParse({shortPhoto}).success).toBe(false);
  });
  it('preserves a seller identity for storefront routing',()=>expect(marketSearch.parse({seller:'seller-account',storeTab:'products'}).seller).toBe('seller-account'));
});
