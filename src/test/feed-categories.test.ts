import {describe,it,expect} from 'vitest';
import {categoryGroups,matchesFeedCategory,normalizeMenuCategory,pickerCategoryOf,postCategoryLabels,primaryCategories} from '@/lib/feed-categories';
import {marketSearch} from '@/lib/market';
const post={title:'Rolex watch',description:'Inspection',category:'Ready to Ship',factory:'VS Factory',sample:false};
describe('Home category filters',()=>{
 it('contains all requested category and brand choices',()=>expect(categoryGroups.flatMap(g=>g.items)).toHaveLength(23));
 it('matches relevant multilingual categories and brands',()=>{
  expect(matchesFeedCategory(post,'rolex')).toBe(true);
  expect(matchesFeedCategory(post,'ready')).toBe(true);
  expect(matchesFeedCategory(post,'watches')).toBe(true);
  expect(matchesFeedCategory(post,'cartier')).toBe(false);
  expect(matchesFeedCategory({...post,title:'반클리프 앤 아펠 목걸이'},'van-cleef')).toBe(true);
 });
 it('has the main row in the requested order',()=>expect(primaryCategories.map(c=>c[0])).toEqual(['recommend','news','ready','story','watches','accessories','bags','clothes','parts','custom','etc']));
 it('matches the new story, bags, clothes and etc categories',()=>{
  expect(matchesFeedCategory({...post,category:'제작 과정'},'story')).toBe(true);
  expect(matchesFeedCategory({...post,title:'Leather tote bag'},'bags')).toBe(true);
  expect(matchesFeedCategory({...post,title:'Denim jacket'},'clothes')).toBe(true);
  expect(matchesFeedCategory({...post,category:'기타'},'etc')).toBe(true);
 });
 it('offers sellers exactly the ten official post categories (no 전체)',()=>expect(postCategoryLabels).toEqual(['뉴스','바로발송','스토리','시계','악세사리','가방','의류','파츠','커스텀 제작','기타']));
 it('filters strictly by the saved menu category',()=>{
  const watch={...post,title:'Leather tote bag',category:'시계',menuCategory:'시계'};
  expect(matchesFeedCategory(watch,'bags')).toBe(false);expect(matchesFeedCategory(watch,'watches')).toBe(true);
  expect(matchesFeedCategory({...watch,menuCategory:'가방'},'bags')).toBe(true);expect(matchesFeedCategory({...watch,menuCategory:'파츠'},'parts')).toBe(true);
  expect(matchesFeedCategory({...watch,menuCategory:'커스텀 제작'},'custom')).toBe(true);expect(matchesFeedCategory({...watch,menuCategory:'커스텀 제작'},'watches')).toBe(false);
  expect(matchesFeedCategory(watch,undefined)).toBe(true);expect(matchesFeedCategory(watch,'recommend')).toBe(true);
 });
 it('falls back to keywords for older posts without a menu category',()=>{expect(matchesFeedCategory({...post,category:'제작 과정'},'story')).toBe(true);expect(matchesFeedCategory({...post,title:'Leather tote bag',category:'시계'},'bags')).toBe(true);});
 it('maps menu categories saved before the cleanup',()=>{
  const watch={...post,title:'Leather tote bag',category:'시계',menuCategory:'커스텀'};
  expect(matchesFeedCategory(watch,'custom')).toBe(true);expect(normalizeMenuCategory('18K 금')).toBe('기타');expect(matchesFeedCategory({...watch,menuCategory:'18K 금'},'etc')).toBe(true);
 });
 it('knows which picker tab a brand belongs to',()=>{expect(pickerCategoryOf('rolex')).toBe('watches');expect(pickerCategoryOf('tiffany')).toBe('accessories');expect(pickerCategoryOf('bags')).toBe('bags');expect(pickerCategoryOf('recommend')).toBeUndefined();});
 it('does not assign a brand to generic watch samples',()=>expect(matchesFeedCategory({...post,title:'Everyday diver',sample:true},'rolex')).toBe(false));
 it('retains the selection below the open picker',()=>expect(marketSearch.parse({feedCategory:'rolex',categoriesOpen:true})).toMatchObject({feedCategory:'rolex',categoriesOpen:true}));
});