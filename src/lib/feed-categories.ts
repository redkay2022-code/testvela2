import {ALL_WATCH_BRANDS} from './watch-brands';
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
export const categoryLabel=(id:string)=>categoryGroups.flatMap(group=>group.items).find(item=>item[0]===id)?.[1] ?? id;
const aliases:Record<string,string[]>={
 news:['news','뉴스'],story:['story','스토리','제작 과정','making'],bags:['bag','bags','handbag','tote','backpack','가방','핸드백','토트'],
 clothes:['clothes','clothing','apparel','jacket','shirt','hoodie','의류','옷','자켓','셔츠','후드'],etc:['etc','others','기타'],ready:['ready to ship','바로발송','바로 발송'],custom:['customizing','customisation','customization','커스텀','커스터마이징'],parts:['parts','part','파츠'],
 watches:['watch','시계'],accessories:['accessory','accessories','악세사리','액세서리','jewelry','jewellery'],
 'solid-gold':['18k solid gold','solid 18k gold','18k 솔리드 골드','18k 통금'],
 rolex:['rolex','롤렉스'],cartier:['cartier','까르띠에','카르티에'],'audemars-piguet':['audemars piguet','오데마 피게'],'patek-philippe':['patek philippe','파텍 필립'],
 'richard-mille':['richard mille','리차드 밀'],omega:['omega','오메가'],panerai:['panerai','파네라이'],iwc:['iwc'],
 'chrome-hearts':['chrome hearts','크롬하츠'],'van-cleef':['van cleef','반클리프 앤 아펠'],boucheron:['boucheron','부쉐론'],bvlgari:['bvlgari','bulgari','불가리'],tiffany:['tiffany','티파니'],
};
export function matchesFeedCategory(post:{title:string;description:string;category:string;factory:string;sample:boolean;menuCategory?:string|undefined;source?:{brand?:string;model?:string}|undefined},id:string|undefined){
 if(!id||id==='recommend')return true;
 const own=postCategories.find(item=>item[0]===id),menu=normalizeMenuCategory(post.menuCategory);
 if(own&&menu&&postCategoryLabels.includes(menu))return menu===own[1];
 if(id==='watches'&&post.sample)return true;
 const text=`${post.title} ${post.description} ${post.category} ${post.factory} ${post.source?.brand ?? ''} ${post.source?.model ?? ''}`.toLowerCase();
 const en=(brandEnglishName(id) ?? id).toLowerCase(),list=aliases[id] ?? [...new Set([en,en.normalize('NFD').replace(/[\u0300-\u036f]/g,'')])];
 // Brand names are matched as whole words so short names (Oris, Rado, Sinn…) do not hit unrelated words.
 if(brandIds.has(id))return list.some(alias=>/^[a-z0-9 .&'-]+$/.test(alias)?new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^a-z0-9])`).test(text):text.includes(alias));
 return list.some(alias=>text.includes(alias));
}