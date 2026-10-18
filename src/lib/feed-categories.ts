import {ALL_WATCH_BRANDS} from './watch-brands';
import {brandNames} from './brand-names';
const brandSlug=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
/** Korean names for the brands shown in Korean in the home category row; every other brand uses its listing name. */
const koreanBrandNames:Record<string,string>={rolex:'롤렉스',cartier:'까르띠에','audemars-piguet':'오데마 피게','patek-philippe':'파텍 필립','richard-mille':'리차드 밀',omega:'오메가',panerai:'파네라이',iwc:'IWC'};
/** Luxury accessory brands (these keep their older ids); Bulgari and Van Cleef & Arpels from the watch list are merged into them. */
const accessoryBrandItems:readonly (readonly [string,string])[]=[['chrome-hearts','크롬하츠'],['van-cleef','반클리프 앤 아펠'],['boucheron','부쉐론'],['bvlgari','불가리'],['tiffany','티파니']];
const mergedAway=new Set(['bulgari','van-cleef-arpels']);
/** Every brand a seller can pick when uploading (the same list as the upload form's brand dropdown), in A-Z order. */
const watchBrandItems:readonly (readonly [string,string])[]=ALL_WATCH_BRANDS.map(name=>[brandSlug(name),name] as const).filter(([id])=>!mergedAway.has(id)).map(([id,name])=>[id,koreanBrandNames[id] ?? name] as const);
export const categoryGroups:readonly {label:string;items:readonly (readonly [string,string])[]}[] = [
 {label:'카테고리',items:[['recommend','전체'],['news','뉴스'],['ready','바로발송'],['story','스토리'],['watches','시계'],['accessories','악세사리'],['bags','가방'],['clothes','의류'],['parts','파츠'],['custom','커스텀 제작'],['etc','기타']]},
 {label:'시계 브랜드',items:watchBrandItems},
 {label:'명품 악세사리 브랜드',items:accessoryBrandItems},
] as const;
/** Ids of the "how to browse" entries (not product categories); the picker shows them in their own row. */
export const viewCategoryIds:readonly string[]=['recommend','news','ready','story'];
/** Product categories (picker tabs); the ones that have brands also list them below. */
export const productCategoryItems:readonly (readonly [string,string])[]=(categoryGroups[0]?.items ?? []).filter(item=>!viewCategoryIds.includes(item[0]));
/** Brand dropdown data for the picker: popular brands first, luxury accessory brands, then every other upload brand A-Z. */
export const brandEnglishName=(id:string):string|undefined=>ALL_WATCH_BRANDS.find(name=>brandSlug(name)===id) ?? ({'chrome-hearts':'Chrome Hearts','van-cleef':'Van Cleef & Arpels',boucheron:'Boucheron',bvlgari:'Bulgari',tiffany:'Tiffany & Co.'} as Record<string,string>)[id];
export const popularBrandIds:readonly string[]=['rolex','patek-philippe','audemars-piguet','cartier','richard-mille','omega','iwc','panerai','hublot'];
export const brandIds=new Set<string>([...watchBrandItems,...accessoryBrandItems].map(item=>item[0]));
export const brandMenu={
 popular:popularBrandIds.map(id=>watchBrandItems.find(item=>item[0]===id)).filter((item):item is readonly [string,string]=>Boolean(item)),
 accessories:accessoryBrandItems,
 others:watchBrandItems.filter(item=>!popularBrandIds.includes(item[0])),
};
/** Menu-category labels saved before the 2026-10 cleanup, mapped to today's labels ("18K 금" was removed and now counts as 기타). */
const legacyMenuLabels:Record<string,string>={'커스텀':'커스텀 제작','18K 금':'기타'};
export const normalizeMenuCategory=(label:string|undefined):string|undefined=>label===undefined?undefined:legacyMenuLabels[label.trim()] ?? label;
export const primaryCategories=categoryGroups[0]?.items ?? [];
/** Menu categories sellers choose from (stored in posts.specs.menuCategory, separate from the older 카테고리 field) (the "전체" entry is a filter only, never a post category). */
export const postCategories:readonly (readonly [string,string])[]=(categoryGroups[0]?.items ?? []).filter(item=>item[0]!=='recommend');
export const postCategoryLabels:readonly string[]=postCategories.map(item=>item[1]);
/** Upload dropdown order: 파츠 right after 시계 (the top menu keeps its own order). */
export const uploadCategoryLabels:readonly string[]=(()=>{const out:string[]=postCategoryLabels.filter(l=>l!=='파츠');const watch=out.indexOf('시계');out.splice(watch<0?out.length:watch+1,0,'파츠');return out;})();
const baseCategoryLabel=(id:string)=>id.startsWith('b:')?id.slice(2):categoryGroups.flatMap(group=>group.items).find(item=>item[0]===id)?.[1] ?? id;
/** Feed ids are a category ("watches"), a brand ("rolex") or both joined with "~" ("watches~rolex" = Rolex within 시계). */
export const splitFeedId=(id:string|undefined):{category:string;brand:string}=>{const i=(id ?? '').indexOf('~');return i<0?{category:id ?? '',brand:''}:{category:id!.slice(0,i),brand:id!.slice(i+1)};};
export const categoryLabel=(id:string)=>{const {category,brand}=splitFeedId(id);return brand?`${baseCategoryLabel(category)} · ${baseCategoryLabel(brand)}`:baseCategoryLabel(id);};
const aliases:Record<string,string[]>={
 news:['news','뉴스'],story:['story','스토리','제작 과정','making'],bags:['bag','bags','handbag','tote','backpack','가방','핸드백','토트'],
 clothes:['clothes','clothing','apparel','jacket','shirt','hoodie','의류','옷','자켓','셔츠','후드'],etc:['etc','others','기타'],ready:['ready to ship','바로발송','바로 발송'],custom:['customizing','customisation','customization','커스텀','커스터마이징'],parts:['parts','part','파츠'],
 watches:['watch','시계'],accessories:['accessory','accessories','악세사리','액세서리','jewelry','jewellery'],
 'solid-gold':['18k solid gold','solid 18k gold','18k 솔리드 골드','18k 통금'],
 rolex:['rolex','롤렉스'],cartier:['cartier','까르띠에','카르티에'],'audemars-piguet':['audemars piguet','오데마 피게'],'patek-philippe':['patek philippe','파텍 필립'],
 'richard-mille':['richard mille','리차드 밀'],omega:['omega','오메가'],panerai:['panerai','파네라이'],iwc:['iwc'],
 'chrome-hearts':['chrome hearts','크롬하츠'],'van-cleef':['van cleef','반클리프 앤 아펠'],boucheron:['boucheron','부쉐론'],bvlgari:['bvlgari','bulgari','불가리'],tiffany:['tiffany','티파니'],
};
export type FeedPostLike={title:string;description:string;category:string;factory:string;sample:boolean;menuCategory?:string|undefined;source?:{brand?:string;model?:string;specs?:unknown}|undefined};
/** Canonical brand id of a post from its brand field ("" when it has none). Brands outside the known list become "b:<name>". */
const brandAlias:Record<string,string>={bulgari:'bvlgari','van-cleef-arpels':'van-cleef','tiffany-co':'tiffany'};
export function postBrandId(post:FeedPostLike):string{
 const specs=post.source?.specs&&typeof post.source.specs==='object'&&!Array.isArray(post.source.specs)?post.source.specs as Record<string,unknown>:{};
 const raw=String(post.source?.brand || (typeof specs['brand']==='string'?specs['brand']:'') || '').trim();
 if(!raw)return '';
 const slug=brandSlug(raw),id=brandAlias[slug] ?? slug;
 return brandIds.has(id)?id:`b:${raw.slice(0,60)}`;
}
export function matchesFeedCategory(post:FeedPostLike,id:string|undefined):boolean{
 if(!id||id==='recommend')return true;
 if(id.includes('~')){const {category,brand}=splitFeedId(id);return matchesFeedCategory(post,category)&&(brand.startsWith('b:')?postBrandId(post).toLowerCase()===brand.toLowerCase():postBrandId(post)===brand||matchesFeedCategory(post,brand));}
 if(id.startsWith('b:'))return postBrandId(post).toLowerCase()===id.toLowerCase();
 const own=postCategories.find(item=>item[0]===id),menu=normalizeMenuCategory(post.menuCategory);
 if(own&&menu&&postCategoryLabels.includes(menu))return menu===own[1];
 if(id==='watches'&&post.sample)return true;
 const text=`${post.title} ${post.description} ${post.category} ${post.factory} ${post.source?.brand ?? ''} ${post.source?.model ?? ''}`.toLowerCase();
 const en=(brandEnglishName(id) ?? id).toLowerCase(),list=aliases[id] ?? [...new Set([en,en.normalize('NFD').replace(/[\u0300-\u036f]/g,'')])];
 // Brand names are matched as whole words so short names (Oris, Rado, Sinn…) do not hit unrelated words.
 if(brandIds.has(id))return list.some(alias=>/^[a-z0-9 .&'-]+$/.test(alias)?new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^a-z0-9])`).test(text):text.includes(alias));
 return list.some(alias=>text.includes(alias));
}
export type BrandChoice={id:string;label:string;count:number};
/** For every product category, the brands of the products registered in it (most products first). */
export function brandsByCategory(posts:readonly FeedPostLike[]):Record<string,BrandChoice[]>{
 const tally=new Map<string,Map<string,BrandChoice>>();
 const labelOf=(bid:string)=>bid.startsWith('b:')?bid.slice(2):[...watchBrandItems,...accessoryBrandItems].find(item=>item[0]===bid)?.[1] ?? bid;
 for(const post of posts){
  const bid=postBrandId(post);if(!bid)continue;
  for(const [cat] of productCategoryItems){
   if(!matchesFeedCategory(post,cat))continue;
   const m=tally.get(cat) ?? new Map<string,BrandChoice>();tally.set(cat,m);
   const row=m.get(bid) ?? {id:bid,label:labelOf(bid),count:0};row.count++;m.set(bid,row);
  }
 }
 const out:Record<string,BrandChoice[]>={};
 for(const [cat] of productCategoryItems)out[cat]=[...(tally.get(cat)?.values() ?? [])].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'en'));
 return out;
}

/** Name to show for a brand id in the given site language (the Latin name when no native-script name is known). */
export function brandDisplayName(id:string,lang:string,fallback?:string):string{
 if(id.startsWith('b:'))return id.slice(2);
 return brandNames[id]?.[lang] ?? brandEnglishName(id) ?? fallback ?? id;
}
const hasNativeName=(id:string,lang:string)=>Boolean(brandNames[id]?.[lang]);
const collationOf=(lang:string)=>lang==='la'?'it':lang==='zh'?'zh-u-co-pinyin':lang;
/** Sorts brand choices for a language: 가나다 for Korean, alphabetical for the others (names written in the language's own script first, then Latin-only names). */
export function sortBrandChoices<T extends {id:string;label:string}>(items:readonly T[],lang:string):T[]{
 const loc=collationOf(lang);let cmp:Intl.Collator;try{cmp=new Intl.Collator(loc,{sensitivity:'base',ignorePunctuation:true});}catch{cmp=new Intl.Collator('en',{sensitivity:'base',ignorePunctuation:true});}
 return [...items].sort((a,b)=>Number(hasNativeName(b.id,lang))-Number(hasNativeName(a.id,lang))||cmp.compare(brandDisplayName(a.id,lang,a.label),brandDisplayName(b.id,lang,b.label)));
}
