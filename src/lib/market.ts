import { queryOptions } from '@tanstack/react-query';
import { getPosts, getStores } from './market.functions';
import { z } from 'zod';
import { stabilizePosts } from './media-cache';
import { perfLog } from './perf';
import type { Database } from '@/integrations/supabase/types';

export type Post = Database['public']['Tables']['posts']['Row'];
export type Mode = 'home' | 'explore' | 'market' | 'me' | 'upload';
export const paths = { home:'/', explore:'/explore', market:'/market', me:'/me', upload:'/upload' } as const;
export const marketSearch = z.object({
  customerTab:z.enum(['saved','orders','qna','likes']).optional(), orderId:z.string().uuid().optional(), orderView:z.enum(['tracking','qc','specs','defect','messages']).optional(),
  studioTab:z.enum(['tier','replacement','reviews']).optional(),
  boardTab:z.enum(['qna','comments','notices']).optional(), boardItem:z.string().max(64).optional(), sellerView:z.enum(['inventory','qna','shipping','orders','content','analytics']).optional(), activity:z.enum(['likes','followers','comments']).optional(), salesPeriod:z.enum(['daily','monthly','yearly']).optional(), salesDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), studioDialog:z.enum(['history','reviews','wallet']).optional(), conversation:z.string().uuid().optional(), question:z.string().optional(),
  collection:z.enum(['watches','accessories']).optional(), watchType:z.enum(['all','automatic','manual','quartz','chronograph','diver','dress','sport']).optional(),
   profileTab:z.enum(['profile','shipping']).optional(), detailTab:z.enum(['qna']).optional(), role:z.enum(['buyer','seller','admin']).optional(), menu:z.boolean().optional(), searchOpen:z.boolean().optional(), categoriesOpen:z.boolean().optional(), feedCategory:z.string().optional(),
   panel:z.enum(['chat','cart','wishlist','checkout','settings','apply','orders','wallet']).optional(), checkoutItem:z.string().optional(), checkoutBox:z.boolean().optional(), checkoutInsurance:z.boolean().optional(),
    storeTab:z.enum(['products','shorts','reviews']).optional(), seller:z.string().optional(), storeCategory:z.string().max(40).optional(),
  section:z.enum(['dashboard','analytics','applications','boards','members','proxy','reviews','loyalty','stores','products','categories','inventory','settings','sellers','verification','crypto','disputes','moderation','settlements','overview','orders','earnings','tier','feed','inbox','reset']).optional(),
   edit:z.string().max(100).optional(), post:z.string().optional(), shorts:z.string().optional(), shortTab:z.enum(['following','recommend']).optional(), shortSheet:z.enum(['product','comments']).optional(), shortPhoto:z.number().int().min(0).max(14).optional(), auth:z.boolean().optional(), authSignup:z.boolean().optional(), notice:z.boolean().optional(),
  feedTopic:z.enum(['recommend','videos','trend','live','football','VS Factory','PPF','3K','APS']).optional(),
  category:z.string().optional(), q:z.string().optional(), fq:z.string().optional(), ffactory:z.string().optional(), fmin:z.number().optional(), fmax:z.number().optional(), fshorts:z.boolean().optional(), fsort:z.enum(['newest','price_desc','price_asc']).optional(), tab:z.enum(['discover','following','lounge','reviews','nearby','likes','posts']).optional(),
});
export const storesQuery = queryOptions({queryKey:['stores'],queryFn:() => getStores(),staleTime:0,refetchOnMount:'always',refetchInterval:45*60_000});
// Fresh for a minute: moving between pages no longer re-downloads and re-signs the whole feed every time.
export const postsQuery = queryOptions({queryKey:['posts'],queryFn:async () => { const t0 = typeof performance !== 'undefined' ? performance.now() : 0; const posts = stabilizePosts(await getPosts()); if (t0) perfLog('feed data', performance.now() - t0); return posts; },staleTime:60_000,refetchInterval:45*60_000,refetchIntervalInBackground:false});
export const pageHead = (title:string,description:string) => ({ meta:[
  {title:`${title} · velamarket 벨라마켓`},
  {name:'description',content:description},
  {property:'og:title',content:`${title} · velamarket`},
  {property:'og:description',content:description},
  {property:'og:type',content:'website'},
  {name:'twitter:card',content:'summary_large_image'},
] });