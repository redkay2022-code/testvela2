export const categoryGroups = [
 {label:'카테고리',items:[['recommend','추천'],['news','뉴스'],['ready','바로발송'],['watches','시계'],['accessories','악세사리'],['custom','커스터마이징'],['solid-gold','18K 솔리드 골드']]},
 {label:'시계 브랜드',items:[['rolex','롤렉스'],['cartier','까르띠에'],['audemars-piguet','오데마 피게'],['patek-philippe','파텍 필립'],['richard-mille','리차드 밀'],['omega','오메가'],['panerai','파네라이'],['iwc','IWC']]},
 {label:'명품 악세사리 브랜드',items:[['chrome-hearts','크롬하츠'],['van-cleef','반클리프 앤 아펠'],['boucheron','부쉐론'],['bvlgari','불가리'],['tiffany','티파니']]},
] as const;
export const primaryCategories=categoryGroups[0].items.slice(0,5);
export const categoryLabel=(id:string)=>categoryGroups.flatMap(group=>group.items).find(item=>item[0]===id)?.[1] ?? id;
const aliases:Record<string,string[]>={
 news:['news','뉴스'],ready:['ready to ship','바로발송','바로 발송'],custom:['customizing','customisation','customization','커스터마이징'],
 watches:['watch','시계'],accessories:['accessory','accessories','악세사리','액세서리','jewelry','jewellery'],
 'solid-gold':['18k solid gold','solid 18k gold','18k 솔리드 골드','18k 통금'],
 rolex:['rolex','롤렉스'],cartier:['cartier','까르띠에','카르티에'],'audemars-piguet':['audemars piguet','오데마 피게'],'patek-philippe':['patek philippe','파텍 필립'],
 'richard-mille':['richard mille','리차드 밀'],omega:['omega','오메가'],panerai:['panerai','파네라이'],iwc:['iwc'],
 'chrome-hearts':['chrome hearts','크롬하츠'],'van-cleef':['van cleef','반클리프 앤 아펠'],boucheron:['boucheron','부쉐론'],bvlgari:['bvlgari','bulgari','불가리'],tiffany:['tiffany','티파니'],
};
export function matchesFeedCategory(post:{title:string;description:string;category:string;factory:string;sample:boolean},id:string|undefined){
 if(!id||id==='recommend')return true;
 if(id==='watches'&&post.sample)return true;
 const text=`${post.title} ${post.description} ${post.category} ${post.factory}`.toLowerCase();
 return (aliases[id] ?? [id.toLowerCase()]).some(alias=>text.includes(alias));
}