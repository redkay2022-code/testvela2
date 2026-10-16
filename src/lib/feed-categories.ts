export const categoryGroups:readonly {label:string;items:readonly (readonly [string,string])[]}[] = [
 {label:'카테고리',items:[['recommend','전체'],['news','뉴스'],['ready','바로발송'],['story','스토리'],['watches','시계'],['accessories','악세사리'],['bags','가방'],['clothes','의류'],['parts','파츠'],['custom','커스텀 제작'],['etc','기타']]},
 {label:'시계 브랜드',items:[['rolex','롤렉스'],['cartier','까르띠에'],['audemars-piguet','오데마 피게'],['patek-philippe','파텍 필립'],['richard-mille','리차드 밀'],['omega','오메가'],['panerai','파네라이'],['iwc','IWC']]},
 {label:'명품 악세사리 브랜드',items:[['chrome-hearts','크롬하츠'],['van-cleef','반클리프 앤 아펠'],['boucheron','부쉐론'],['bvlgari','불가리'],['tiffany','티파니']]},
] as const;
/** Ids of the "how to browse" entries (not product categories); the picker shows them in their own row. */
export const viewCategoryIds:readonly string[]=['recommend','news','ready','story'];
/** Product categories (picker tabs); the ones that have brands also list them below. */
export const productCategoryItems:readonly (readonly [string,string])[]=(categoryGroups[0]?.items ?? []).filter(item=>!viewCategoryIds.includes(item[0]));
/** Brand lists keyed by the product category they belong to. */
export const brandGroupByCategory:Readonly<Record<string,{label:string;items:readonly (readonly [string,string])[]}>>={watches:categoryGroups[1]!,accessories:categoryGroups[2]!};
/** Category a selected id belongs to in the picker (a brand belongs to its group's category). */
export const pickerCategoryOf=(id:string|undefined):string|undefined=>!id?undefined:Object.entries(brandGroupByCategory).find(([,g])=>g.items.some(i=>i[0]===id))?.[0] ?? (productCategoryItems.some(i=>i[0]===id)?id:undefined);
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
 return (aliases[id] ?? [id.toLowerCase()]).some(alias=>text.includes(alias));
}