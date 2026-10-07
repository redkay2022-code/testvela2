import type { LuxuryPost } from './luxury-market';
export const watchTypes = [['all','전체 시계'],['automatic','자동 시계'],['manual','수동 시계'],['quartz','쿼츠 시계'],['chronograph','크로노그래프'],['diver','다이버 시계'],['dress','드레스 시계'],['sport','스포츠 시계']] as const;
const typeWords = {automatic:['automatic','자동'],manual:['manual','hand-wound','수동'],quartz:['quartz','쿼츠'],chronograph:['chronograph','크로노그래프','daytona'],diver:['diver','다이버','submariner','seamaster'],dress:['dress','드레스'],sport:['sport','스포츠','nautilus','royal oak']} as const;
export function matchesCollection(post:LuxuryPost,collection:'watches'|'accessories',type:string='all') {
 const text=`${post.title} ${post.description} ${post.category} ${post.factory} ${JSON.stringify(post.source.specs ?? {})}`.toLowerCase();
 const accessory=/accessor|액세서리|악세사리|jewel|주얼리|strap|스트랩|winder|와인더|presentation box|box set|보관함/.test(text);
 if(collection==='accessories')return accessory;
 if(accessory)return false;
 if(type==='all')return true;
 const words=typeWords[type as keyof typeof typeWords];
 return Boolean(words?.some(word=>text.includes(word)));
}
