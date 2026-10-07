import watch0 from '@/assets/watch-0.webp';
import watch1 from '@/assets/watch-1.webp';
import watch2 from '@/assets/watch-2.webp';
import watch3 from '@/assets/watch-3.webp';
import watch4 from '@/assets/watch-4.webp';
import watch5 from '@/assets/watch-5.webp';
import studioShort from '@/assets/studio-short.webm';
import studioShort5 from '@/assets/studio-short-5.webm';
import studioShort2 from '@/assets/studio-short-2.webm';
import { media } from './market-media';
import type { Post } from './market';

export const watchImages = [watch0,watch1,watch2,watch3,watch4,watch5];
export const luxuryCategories = ['All','News','Ready to Ship','Customizing','VS Factory','3K','APS','PPF'];
const ids = ['sunny-room','daily-bag','matcha-day','linen-day','room-corner','tulips','blue-cup','sea-trip','film-camera','white-sneakers','cafe-corner','spring-walk'];
const titles = ['The everyday diver. An extraordinary detail.','A quieter kind of statement.','Green dial, perfect proportions.','Inside the movement: every second matters.','The blue dial you keep coming back to.','On the bench. Behind the craft.','Steel, sapphire and a timeless silhouette.','A closer look at the classic dress watch.','Fresh from the studio: the green collection.','Rose gold. Open heart.','Blue hour, on your wrist.','A final inspection before it’s yours.'];
export type LuxuryPost = {id:string;title:string;description:string;creator:string;images:string[];video:string|null;short:boolean;price:number|null;factory:string;category:string;views:string;likes:number;verified:boolean;sample:boolean;source:Post};
export function luxuryPosts(posts:Post[]):LuxuryPost[] {
 return posts.map(post => {
  const index=ids.indexOf(post.id), sample=index>=0, i=sample?index:0;
  const photo=watchImages[i%6] ?? watch0;
  return {id:post.id,source:post,sample,title:sample?titles[i] ?? post.title:post.title,
   creator:sample?'VS Watch Studio':post.creator,
   description:sample?'Precision in every detail. A 1:1 specification studio sample, individually inspected for finish, alignment and movement performance. Full inspection photos are available before shipping.':post.description,
   images:sample?[photo,watchImages[(i+5)%6] ?? photo,photo]:post.media_urls.length?post.media_urls:[media[post.image_key] || watch0],
    video:sample&&[3,5,8,11].includes(i)?(i===3?studioShort:i===8?studioShort2:studioShort5):post.video_url,short:sample?[3,5,8,11].includes(i):Boolean(post.video_url),
   price:sample?([480,365,520,680,445,480][i%6] ?? 480):post.price,
   factory:sample?(['VS Factory','PPF','3K','APS'][i%4] ?? 'VS Factory'):post.category,
   category:sample?(['Ready to Ship','Ready to Ship','Customizing','News'][i%4] ?? 'Ready to Ship'):post.category,
   views:sample?(['3.2K','1.8K','4.6K','8.1K','2.4K','5.7K'][i%6] ?? '0'):'0',likes:post.base_likes,verified:sample&&i%4!==3};
 });
}
export const dollars=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);
