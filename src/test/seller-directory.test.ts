import {describe,it,expect} from 'vitest';
import {directorySellers,matchesStoreCategory,sellerIdentity,storeFilters} from '@/lib/seller-directory';
import {marketSearch} from '@/lib/market';
import {unknownReputation,studioReputation} from '@/lib/reputation';
import type {LuxuryPost} from '@/lib/luxury-market';
const post={id:'live',title:'시계 watch',description:'Independent collection',category:'Watches',factory:'',creator:'Studio',sample:false,source:{user_id:'owner'},reputation:unknownReputation} as LuxuryPost;
describe('seller directory',()=>{
 it('groups owners without merging unrelated sellers with the same display name',()=>{
  const sellers=directorySellers([post,{...post,id:'second'}, {...post,id:'third',source:{...post.source,user_id:'other'}}]);
  expect(sellers).toHaveLength(2);expect(sellers[0]?.items).toHaveLength(2);
 });
 it('keeps editorial studio identity separate from account owners',()=>expect(sellerIdentity({...post,sample:true,creator:'VS Watch Studio'})).toBe('VS Watch Studio'));
 it('does not invent ratings, reviews or followers for live sellers',()=>{
  const seller=directorySellers([post])[0];expect(seller).toMatchObject({rating:null,reviews:null,followers:null});
 });
 it('matches listing-backed categories using the same rules as the main page',()=>{
  const seller=directorySellers([post])[0];if(!seller)throw new Error('Missing seller');
  expect(matchesStoreCategory(seller,'all')).toBe(true);
  expect(matchesStoreCategory(seller,'watches')).toBe(true);expect(matchesStoreCategory(seller,'accessories')).toBe(false);
  const parts=directorySellers([{...post,menuCategory:'파츠'}])[0];if(!parts)throw new Error('Missing seller');
  expect(matchesStoreCategory(parts,'parts')).toBe(true);expect(matchesStoreCategory(parts,'bags')).toBe(false);
  expect(matchesStoreCategory(seller,'unknown-old-link')).toBe(true);
 });
 it('uses the main page category row and keeps selection in validated URL state',()=>{
  expect(storeFilters.map(f=>f[1])).toEqual(['전체','시계','악세사리','가방','의류','파츠','커스텀 제작','기타']);
  expect(marketSearch.parse({storeCategory:'custom',role:'buyer',panel:'cart'})).toMatchObject({storeCategory:'custom',role:'buyer',panel:'cart'});
 });
});
