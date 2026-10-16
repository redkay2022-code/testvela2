import {describe,it,expect} from 'vitest';
import {brandDisplayName,sortBrandChoices,categoryGroups,brandMenu,brandsByCategory,categoryLabel,splitFeedId,postBrandId,matchesFeedCategory,normalizeMenuCategory,postCategoryLabels,primaryCategories} from '@/lib/feed-categories';
import {ALL_WATCH_BRANDS} from '@/lib/watch-brands';
import {marketSearch} from '@/lib/market';
const post={title:'Rolex watch',description:'Inspection',category:'Ready to Ship',factory:'VS Factory',sample:false};
describe('Home category filters',()=>{
 it('contains every upload brand plus the category choices',()=>expect(categoryGroups.flatMap(g=>g.items).length).toBeGreaterThan(60));
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
 it('offers every brand a seller can pick when uploading',()=>{
  const ids=new Set(categoryGroups.flatMap(g=>g.items).map(i=>i[0]));
  for(const name of ALL_WATCH_BRANDS){const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
   const merged=slug==='bulgari'?'bvlgari':slug==='van-cleef-arpels'?'van-cleef':slug;expect(ids.has(merged)).toBe(true);}
  expect(brandMenu.popular.map(b=>b[0])).toContain('hublot');
 });
 it('matches newly added brands as whole words',()=>{
  expect(matchesFeedCategory({...post,title:'Tag Heuer Carrera',category:'시계'},'tag-heuer')).toBe(true);
  expect(matchesFeedCategory({...post,title:'Colorado watch',category:'시계'},'rado')).toBe(false);
  expect(matchesFeedCategory({...post,title:'Bulgari ring',category:'악세사리'},'bvlgari')).toBe(true);
 });
 it('combines a category with a brand ("watches~rolex") and lists brands per category from registered products',()=>{
  const mk=(title:string,brand:string,menu:string)=>({...post,title,menuCategory:menu,source:{brand}});
  const list=[mk('A','ROLEX','시계'),mk('B','ROLEX','시계'),mk('C','Hermès','가방'),mk('D','Tiffany & Co.','악세사리'),mk('E','My Own Label','가방')];
  expect(matchesFeedCategory(list[0]!,'watches~rolex')).toBe(true);expect(matchesFeedCategory(list[2]!,'watches~rolex')).toBe(false);expect(matchesFeedCategory(list[2]!,'bags~hermes')).toBe(true);
  expect(matchesFeedCategory(list[4]!,'bags~b:My Own Label')).toBe(true);expect(postBrandId(list[3]!)).toBe('tiffany');
  const by=brandsByCategory(list);
  expect(by['watches']).toEqual([{id:'rolex',label:'롤렉스',count:2}]);expect(by['bags']!.map(b=>b.id).sort()).toEqual(['b:My Own Label','hermes']);expect(by['accessories']!.map(b=>b.id)).toEqual(['tiffany']);expect(by['parts']).toEqual([]);
  expect(splitFeedId('watches~rolex')).toEqual({category:'watches',brand:'rolex'});expect(categoryLabel('watches~rolex')).toBe('시계 · 롤렉스');
 });
 it('does not assign a brand to generic watch samples',()=>expect(matchesFeedCategory({...post,title:'Everyday diver',sample:true},'rolex')).toBe(false));
 it('retains the selection below the open picker',()=>expect(marketSearch.parse({feedCategory:'rolex',categoriesOpen:true})).toMatchObject({feedCategory:'rolex',categoriesOpen:true}));
 it('shows brand names in each language and sorts them (가나다 / alphabetical)',()=>{
  const ids=['rolex','omega','cartier','tag-heuer','hermes','b:Zed Label','b:Alpha'];
  const order=(lang:string)=>sortBrandChoices(ids.map(id=>({id,label:id})),lang).map(i=>brandDisplayName(i.id,lang));
  expect(brandDisplayName('rolex','ko')).toBe('롤렉스');expect(brandDisplayName('rolex','zh')).toBe('劳力士');expect(brandDisplayName('rolex','ja')).toBe('ロレックス');expect(brandDisplayName('rolex','ru')).toBe('Ролекс');expect(brandDisplayName('rolex','ar')).toBe('رولكس');
  expect(brandDisplayName('rolex','de')).toBe('ROLEX');expect(brandDisplayName('b:Zed Label','ko')).toBe('Zed Label');
  expect(order('ko')).toEqual(['까르띠에','롤렉스','에르메스','오메가','태그호이어','Alpha','Zed Label']);
  expect(order('en')).toEqual(['Alpha','CARTIER','Hermès','OMEGA','ROLEX','TAG Heuer','Zed Label']);
  expect(order('ru')).toEqual(['Картье','Омега','Ролекс','ТАГ Хойер','Эрмес','Alpha','Zed Label']);
 });
});