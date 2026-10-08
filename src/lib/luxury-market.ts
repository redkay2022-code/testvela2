import { formatMoney } from './currency';
import watch0 from '@/assets/watch-0.webp';
import watch1 from '@/assets/watch-1.webp';
import watch2 from '@/assets/watch-2.webp';
import watch3 from '@/assets/watch-3.webp';
import watch4 from '@/assets/watch-4.webp';
import watch5 from '@/assets/watch-5.webp';
import shortMp4 from '@/assets/studio-short.mp4';
import short5Mp4 from '@/assets/studio-short-5.mp4';
import short2Mp4 from '@/assets/studio-short-2.mp4';
import studioShort from '@/assets/studio-short.webm';
import studioShort5 from '@/assets/studio-short-5.webm';
import studioShort2 from '@/assets/studio-short-2.webm';
import { media } from './market-media';
import type { Post } from './market';
import { studioReputation, unknownReputation, type SellerReputation } from './reputation';

export const watchImages = [watch0,watch1,watch2,watch3,watch4,watch5];
export const luxuryCategories = ['All','News','Ready to Ship','Customizing','VS Factory','3K','APS','PPF'];
const ids = ['sunny-room','daily-bag','matcha-day','linen-day','room-corner','tulips','blue-cup','sea-trip','film-camera','white-sneakers','cafe-corner','spring-walk'];
const titles = ['The everyday diver. An extraordinary detail.','A quieter kind of statement.','Green dial, perfect proportions.','Inside the movement: every second matters.','The blue dial you keep coming back to.','On the bench. Behind the craft.','Steel, sapphire and a timeless silhouette.','A closer look at the classic dress watch.','Fresh from the studio: the green collection.','Rose gold. Open heart.','Blue hour, on your wrist.','A final inspection before it’s yours.'];
export type StoreSummary = {id:string;slug:string;store_name:string;verification_status:string;featured:boolean};
export type FeedPost = Post & {store?: StoreSummary | null};
const seedVideos:Record<string,[string,string]>={'seed:short-0':[studioShort,shortMp4],'seed:short-1':[studioShort5,short5Mp4],'seed:short-2':[studioShort2,short2Mp4]};
const seedImage=(token:string)=>watchImages[Number(token.replace('seed:watch-',''))] ?? watch0;
export type LuxuryPost = {outOfStock?:boolean;featured?:boolean;storeSlug?:string;id:string;title:string;description:string;creator:string;images:string[];video:string|null;videoFallback?:string|undefined;short:boolean;price:number|null;boxPrice:number|null;factory:string;category:string;views:string;likes:number;verified:boolean;sample:boolean;source:Post;reputation:SellerReputation};
export function luxuryPosts(posts:FeedPost[]):LuxuryPost[] {
 return posts.map(post => {
  const extra={outOfStock:post.product_status==='OUT_OF_STOCK',featured:post.featured,storeSlug:post.store?.slug,verified:post.store?post.store.verification_status!=='UNVERIFIED':false};
  if(post.image_key==='seed'){
   const v=post.video_url?seedVideos[post.video_url]:undefined; const specs=(post.specs ?? {}) as Record<string,unknown>;
   return {...extra,id:post.id,source:post,sample:false,reputation:unknownReputation,title:post.title,creator:post.creator,description:post.description,images:post.media_urls.map(seedImage),video:v?.[0] ?? null,videoFallback:v?.[1],short:Boolean(v),boxPrice:post.box_price ?? null,price:post.price,factory:typeof specs['factory']==='string'?specs['factory']:post.category,category:post.category,views:'0',likes:post.base_likes};
  }
  const index=ids.indexOf(post.id), sample=index>=0, i=sample?index:0;
  const photo=watchImages[i%6] ?? watch0;
   return {...extra,id:post.id,source:post,sample,reputation:unknownReputation,title:sample?titles[i] ?? post.title:post.title,
   creator:post.creator,
   description:sample?'Precision in every detail. A 1:1 specification studio sample, individually inspected for finish, alignment and movement performance. Full inspection photos are available before shipping.':post.description,
   images:sample?[photo,watchImages[(i+5)%6] ?? photo,photo]:post.media_urls.length?post.media_urls:[media[post.image_key] || watch0],
    video:sample&&[3,5,8,11].includes(i)?(i===3?studioShort:i===8?studioShort2:studioShort5):post.video_url,short:sample?[3,5,8,11].includes(i):Boolean(post.video_url),
   videoFallback:sample&&[3,5,8,11].includes(i)?(i===3?shortMp4:i===8?short2Mp4:short5Mp4):undefined,
   boxPrice:sample?50:(post.box_price ?? null),
   price:sample?([480,365,520,680,445,480][i%6] ?? 480):post.price,
   factory:sample?(['VS Factory','PPF','3K','APS'][i%4] ?? 'VS Factory'):post.category,
   category:sample?(['Ready to Ship','Ready to Ship','Customizing','News'][i%4] ?? 'Ready to Ship'):post.category,
   views:'0',likes:post.base_likes};
 });
}
/** Formats a base-USD amount in the active display currency. */
export const dollars=(amount:number)=>formatMoney(amount);
