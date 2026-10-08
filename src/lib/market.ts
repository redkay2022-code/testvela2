import { queryOptions } from '@tanstack/react-query';
import { getPosts, getStores } from './market.functions';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';

export type Post = Database['public']['Tables']['posts']['Row'];
export type Mode = 'home' | 'explore' | 'market' | 'me' | 'upload';
export const paths = { home:'/', explore:'/explore', market:'/market', me:'/me', upload:'/upload' } as const;
export const marketSearch = z.object({
  collection:z.enum(['watches','accessories']).optional(), watchType:z.enum(['all','automatic','manual','quartz','chronograph','diver','dress','sport']).optional(),
   profileTab:z.enum(['profile','shipping']).optional(), detailTab:z.enum(['qna']).optional(), role:z.enum(['buyer','seller','admin']).optional(), menu:z.boolean().optional(), searchOpen:z.boolean().optional(), categoriesOpen:z.boolean().optional(), feedCategory:z.string().optional(),
   panel:z.enum(['chat','cart','wishlist','checkout','settings','apply','orders']).optional(), checkoutItem:z.string().optional(), checkoutBox:z.boolean().optional(),
    storeTab:z.enum(['products','shorts','reviews']).optional(), seller:z.string().optional(), storeCategory:z.enum(['all','watches','accessories','custom','solid-gold','top']).optional(),
  section:z.enum(['dashboard','stores','products','categories','inventory','settings','sellers','verification','crypto','disputes','moderation','settlements','overview','orders','earnings','tier']).optional(),
   edit:z.string().max(100).optional(), post:z.string().optional(), shorts:z.string().optional(), shortTab:z.enum(['following','recommend']).optional(), shortSheet:z.enum(['product','comments']).optional(), shortPhoto:z.number().int().min(0).max(14).optional(), auth:z.boolean().optional(), notice:z.boolean().optional(),
  feedTopic:z.enum(['recommend','videos','trend','live','football','VS Factory','PPF','3K','APS']).optional(),
  category:z.string().optional(), q:z.string().optional(), fq:z.string().optional(), ffactory:z.string().optional(), fmin:z.number().optional(), fmax:z.number().optional(), fshorts:z.boolean().optional(), fsort:z.enum(['newest','price_desc','price_asc']).optional(), tab:z.enum(['discover','following','reviews','nearby','likes','posts']).optional(),
});
export const storesQuery = queryOptions({queryKey:['stores'],queryFn:() => getStores(),staleTime:0,refetchOnMount:'always',refetchInterval:45*60_000});
export const postsQuery = queryOptions({queryKey:['posts'],queryFn:() => getPosts(),staleTime:0,refetchOnMount:'always',refetchInterval:45*60_000,refetchIntervalInBackground:false});
export const pageHead = (title:string,description:string) => ({ meta:[
  {title:`${title} · velamarket 벨라마켓`},
  {name:'description',content:description},
  {property:'og:title',content:`${title} · velamarket`},
  {property:'og:description',content:description},
  {property:'og:type',content:'website'},
  {name:'twitter:card',content:'summary_large_image'},
] });