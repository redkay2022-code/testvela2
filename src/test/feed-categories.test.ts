import {describe,it,expect} from 'vitest';
import {categoryGroups,matchesFeedCategory} from '@/lib/feed-categories';
import {marketSearch} from '@/lib/market';
const post={title:'Rolex watch',description:'Inspection',category:'Ready to Ship',factory:'VS Factory',sample:false};
describe('Home category filters',()=>{
 it('contains all requested category and brand choices',()=>expect(categoryGroups.flatMap(g=>g.items)).toHaveLength(20));
 it('matches relevant multilingual categories and brands',()=>{
  expect(matchesFeedCategory(post,'rolex')).toBe(true);
  expect(matchesFeedCategory(post,'ready')).toBe(true);
  expect(matchesFeedCategory(post,'watches')).toBe(true);
  expect(matchesFeedCategory(post,'cartier')).toBe(false);
  expect(matchesFeedCategory({...post,title:'반클리프 앤 아펠 목걸이'},'van-cleef')).toBe(true);
 });
 it('does not assign a brand to generic watch samples',()=>expect(matchesFeedCategory({...post,title:'Everyday diver',sample:true},'rolex')).toBe(false));
 it('retains the selection below the open picker',()=>expect(marketSearch.parse({feedCategory:'rolex',categoriesOpen:true})).toMatchObject({feedCategory:'rolex',categoriesOpen:true}));
});