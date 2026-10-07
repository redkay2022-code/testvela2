import { queryOptions } from '@tanstack/react-query';
import { getPosts } from './market.functions';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';

export type Post = Database['public']['Tables']['posts']['Row'];
export type Mode = 'home' | 'explore' | 'market' | 'me' | 'upload';
export const paths = { home:'/', explore:'/explore', market:'/market', me:'/me', upload:'/upload' } as const;
export const marketSearch = z.object({
  role:z.enum(['buyer','seller','admin']).optional(), menu:z.boolean().optional(), searchOpen:z.boolean().optional(),
  panel:z.enum(['chat','cart','checkout','settings','apply','orders']).optional(),
  storeTab:z.enum(['products','shorts','reviews']).optional(),
  section:z.enum(['sellers','verification','moderation','settlements','overview','orders','earnings']).optional(),
  post:z.string().optional(), shorts:z.string().optional(), shortSheet:z.enum(['product','comments']).optional(), auth:z.boolean().optional(), notice:z.boolean().optional(),
  category:z.string().optional(), q:z.string().optional(), tab:z.enum(['discover','following','nearby','likes','posts']).optional(),
});
export const postsQuery = queryOptions({queryKey:['posts'],queryFn:() => getPosts(),staleTime:30_000});
export const pageHead = (title:string,description:string) => ({ meta:[
  {title:`${title} · velamarket 벨라마켓`},
  {name:'description',content:description},
  {property:'og:title',content:`${title} · velamarket`},
  {property:'og:description',content:description},
  {property:'og:type',content:'website'},
  {name:'twitter:card',content:'summary_large_image'},
] });