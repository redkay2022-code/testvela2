import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';

function publicClient() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('마켓에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
}

export const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().from('posts').select('*').order('created_at', { ascending: false }).order('id');
  if (error) throw new Error('피드를 불러오지 못했습니다.');
  // Editorial order is stable for the initial collection; new posts appear first.
  const order = ['sunny-room','daily-bag','matcha-day','linen-day','room-corner','tulips','blue-cup','sea-trip','film-camera','white-sneakers','cafe-corner','spring-walk'];
  return data.sort((a,b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
    if (ai < 0 && bi < 0) return b.created_at.localeCompare(a.created_at);
    if (ai < 0) return -1;
    if (bi < 0) return 1;
    return ai-bi;
  });
});

export const getComments = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ postId: z.string().max(100) }).parse(data))
  .handler(async ({data}) => {
    const { data: rows, error } = await publicClient().from('comments').select('*').eq('post_id',data.postId).order('created_at');
    if (error) throw new Error('댓글을 불러오지 못했습니다.');
    return rows;
  });

export const addComment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ postId:z.string().max(100), body:z.string().trim().min(1).max(1000) }).parse(data))
  .handler(async ({data,context}) => {
    const creator = String(context.claims.user_metadata?.display_name || context.claims.email?.split('@')[0] || 'vela member').slice(0,40);
    const {error} = await context.supabase.from('comments').insert({post_id:data.postId,user_id:context.userId,creator,body:data.body});
    if(error) throw new Error('댓글을 저장하지 못했습니다.');
    return {ok:true};
  });

export const setLike = createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator((data:unknown) => z.object({postId:z.string().max(100),liked:z.boolean()}).parse(data))
  .handler(async ({data,context}) => {
    const result = data.liked
      ? await context.supabase.from('likes').upsert({post_id:data.postId,user_id:context.userId})
      : await context.supabase.from('likes').delete().eq('post_id',data.postId).eq('user_id',context.userId);
    if(result.error) throw new Error('좋아요를 저장하지 못했습니다.');
    return {ok:true};
  });