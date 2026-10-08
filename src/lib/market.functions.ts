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
  const { data, error } = await publicClient().from('posts').select('*, store:stores(id,slug,store_name,verification_status,featured)').order('created_at', { ascending: false }).order('id');
  if (error) throw new Error('피드를 불러오지 못했습니다.');
  const uploaded = data.filter(p => p.image_key === 'uploaded' || p.image_key === 'seed');
  if (uploaded.length) {
    // Only paths referenced by publicly readable posts can be signed here; bundled seed tokens pass through.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const permitted = (post:typeof uploaded[number],path:string) => !path.includes('..') && (path.startsWith('seed:') || Boolean(post.store_id && path.split('/').length >= 2) || Boolean(post.user_id && path.startsWith(`${post.user_id}/`)));
    const paths = [...new Set(uploaded.flatMap(p => [...p.media_urls,...(p.video_url ? [p.video_url]:[])].filter(path => permitted(p,path) && !path.startsWith('seed:'))))];
    const {data:signed,error:signError} = paths.length ? await supabaseAdmin.storage.from('market-media').createSignedUrls(paths,3600) : {data:[],error:null};
    if(signError) throw new Error('게시물 사진을 불러오지 못했습니다.');
    const urls = new Map(signed?.map(s => [s.path,s.signedUrl]) || []);
    for(const post of uploaded) {
      const sign = (path:string) => path.startsWith('seed:') ? path : urls.get(path) || '';
      post.media_urls = post.media_urls.filter(path => permitted(post,path)).map(sign).filter(Boolean);
      if(post.video_url) post.video_url = permitted(post,post.video_url) ? sign(post.video_url) || null : null;
    }
  }
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

export const getStores = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().from('stores')
    .select('id,store_name,slug,logo,cover_image,avatar,description,country,city,specialties,shipping_regions,shipping_information,response_time,verification_status,featured')
    .order('featured', { ascending: false }).order('store_name');
  if (error) throw new Error('스토어를 불러오지 못했습니다.');
  const paths = [...new Set(data.flatMap(s => [s.logo, s.cover_image, s.avatar]).filter((p): p is string => Boolean(p && !p.includes('..'))))];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: signed } = await supabaseAdmin.storage.from('market-media').createSignedUrls(paths, 3600);
    signed?.forEach(item => { if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl); });
  }
  const sign = (p: string | null) => (p ? urls.get(p) ?? null : null);
  return data.map(s => ({ ...s, logo: sign(s.logo), cover_image: sign(s.cover_image), avatar: sign(s.avatar) }));
});

export const getComments = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ postId: z.string().max(100) }).parse(data))
  .handler(async ({data}) => {
    const { data: rows, error } = await publicClient().from('comments').select('*').eq('post_id',data.postId).order('created_at');
    if (error) throw new Error('댓글을 불러오지 못했습니다.');
    return rows;
  });

export const getPublicReviews = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ sellerId: z.string().max(100).optional() }).parse(data))
  .handler(async ({ data }) => {
    const columns = 'id,nickname,seller_id,seller_name,body,media_urls,video_url,created_at';
    let query = publicClient().from('reviews').select(columns).order('created_at', { ascending: false }).limit(60);
    if (data.sellerId) query = query.eq('seller_id', data.sellerId);
    const { data: rows, error } = await query;
    if (error) throw new Error('리뷰를 불러오지 못했습니다.');
    const paths = [...new Set((rows ?? []).flatMap(row => [...row.media_urls, ...(row.video_url ? [row.video_url] : [])])
      .filter(path => !path.includes('..') && path.split('/').length === 2))];
    const urls: Record<string, string> = {};
    if (paths.length) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: signed, error: signError } = await supabaseAdmin.storage.from('review-media').createSignedUrls(paths, 3600);
      if (signError) throw new Error('리뷰 미디어를 불러오지 못했습니다.');
      signed?.forEach(item => { if (item.path && item.signedUrl) urls[item.path] = item.signedUrl; });
    }
    return (rows ?? []).map(row => ({ ...row, urls }));
  });

export const addComment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ postId:z.string().max(100), body:z.string().trim().min(1).max(1000) }).parse(data))
  .handler(async ({data,context}) => {
    const metadata = context.claims.user_metadata;
    const name = metadata && typeof metadata === 'object' && 'display_name' in metadata ? metadata['display_name'] : undefined;
    const creator = String(name || context.claims.email?.split('@')[0] || 'vela member').slice(0,40);
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