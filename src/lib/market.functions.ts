import { createServerFn } from '@tanstack/react-start';
import { avatarKey, defaultAvatarUrl } from '@/lib/default-avatar';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import { commentAvatarPath, commentNickname } from './comment-profiles';
import { isExternalVideo, isMuxPending, isMuxStreamUrl, muxThumbnailUrl } from './mux';
import { SharedFeedCache, SignedUrlMemo } from './feed-cache';

const signedMemo = new SignedUrlMemo();

function publicClient(bearer?: string | null) {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('마켓에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
}

/** Catalog reads run as the caller when signed in, so sellers also see their own unpublished rows. */
async function callerToken() {
  const { getRequestHeader } = await import('@tanstack/react-start/server');
  const h = getRequestHeader('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

async function loadPosts(token: string | null) {
  // Every column except `translations`: saved machine translations (up to 10 languages per post) are never read from the
  // feed (cards fetch their own language through post-translation-batch), but used to be sent for every post.
  const { data: feedRows, error } = await publicClient(token).from('posts').select('base_likes,box_price,brand,category,created_at,creator,currency,data_source,description,dispatch_time,duration,featured,id,image_key,low_stock_threshold,media_urls,model,music_artist,music_audio_url,music_license_url,music_title,music_track_id,price,product_status,reference,reserved_qty,sku,source_lang,specs,status,stock_qty,store_id,subcategory,thumbnail_url,title,updated_at,user_id,video_tags,video_url, store:stores(id,slug,store_name,verification_status,featured)').order('created_at', { ascending: false }).order('id');
  if (error) throw new Error('피드를 불러오지 못했습니다.');
  const data = feedRows.map(row => ({ ...row, translations: {} as Database['public']['Tables']['posts']['Row']['translations'] }));
  const uploaded = data.filter(p => p.image_key === 'uploaded' || p.image_key === 'seed');
  if (uploaded.length) {
    // Only paths referenced by publicly readable posts can be signed here; bundled seed tokens pass through.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const permitted = (post:typeof uploaded[number],path:string) => !path.includes('..') && (path.startsWith('seed:') || Boolean(post.store_id && path.split('/').length >= 2) || Boolean(post.user_id && path.startsWith(`${post.user_id}/`)));
    const cardPath = (post:typeof uploaded[number]):string|null => { const specs = post.specs; const card = specs && typeof specs === 'object' && !Array.isArray(specs) ? (specs as Record<string,unknown>)['cardImage'] : null; return typeof card === 'string' ? card : null; };
    const paths = [...new Set(uploaded.flatMap(p => [...p.media_urls,...(p.video_url && !isExternalVideo(p.video_url) ? [p.video_url]:[]),...(p.thumbnail_url && !isMuxStreamUrl(p.video_url) ? [p.thumbnail_url]:[]),...(cardPath(p) ? [cardPath(p) as string]:[])].filter(path => permitted(p,path) && !path.startsWith('seed:'))))];
    // Sign in small batches: one oversized request used to fail the whole feed once many posts were published.
    // A batch that fails only drops its own media (the post still renders without it) instead of breaking the page.
    // Links signed in the last 5 hours are reused (they stay valid for 6); only new or expired paths are signed again.
    const urls = new Map<string,string>();
    const todo = signedMemo.missing(paths);
    const batches:string[][] = []; for(let i=0;i<todo.length;i+=100) batches.push(todo.slice(i,i+100));
    await Promise.all(batches.map(async batch => {
      try {
        const {data:signed,error:signError} = await supabaseAdmin.storage.from('market-media').createSignedUrls(batch,21600);
        if(signError) { console.error('feed media signing failed', signError.message); return; }
        signed?.forEach(s => { if(s.path && s.signedUrl) signedMemo.set(s.path,s.signedUrl); });
      } catch(e) { console.error('feed media signing failed', e); }
    }));
    for(const path of paths) { const url = signedMemo.get(path); if(url) urls.set(path,url); }
    for(const post of uploaded) {
      const sign = (path:string) => path.startsWith('seed:') ? path : urls.get(path) || '';
      post.media_urls = post.media_urls.filter(path => permitted(post,path)).map(sign).filter(Boolean);
      const card = cardPath(post);
      if(card) { const { cardImage: _unsigned, ...restSpecs } = post.specs as Record<string,unknown>; post.specs = (permitted(post,card) && urls.get(card) ? { ...restSpecs, cardImage: urls.get(card) } : restSpecs) as typeof post.specs; }
      // Mux videos use Mux's image CDN for the poster: faster, cacheable, and no signing work on every feed load.
      if(isMuxStreamUrl(post.video_url)) post.thumbnail_url = muxThumbnailUrl(post.video_url);
      else if(post.thumbnail_url) post.thumbnail_url = permitted(post,post.thumbnail_url) ? urls.get(post.thumbnail_url) || null : null;
      // Mux streams are public HLS URLs (no signing); videos still processing on Mux are hidden until ready.
      if(post.video_url) post.video_url = isMuxStreamUrl(post.video_url) ? post.video_url : isMuxPending(post.video_url) ? null : permitted(post,post.video_url) ? sign(post.video_url) || null : null;
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
}

/**
 * Visitors who are not signed in all get the same public feed, so it is built once and shared for 2 minutes
 * (signed photo/video links stay valid for 6 hours). Many visitors at once, or a quick refresh, no longer each
 * repeat the database read and the link signing. Signed-in callers are never cached: sellers must see their own drafts.
 */
const publicFeed = new SharedFeedCache<Awaited<ReturnType<typeof loadPosts>>>(120_000);

export const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  const token = await callerToken();
  if (token) return loadPosts(token);
  return publicFeed.get(() => loadPosts(null));
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
  .inputValidator((data: unknown) => z.object({ postId: z.string().max(100), kind: z.enum(['comment','qna']).default('comment') }).parse(data))
  .handler(async ({data}) => {
    const client = publicClient(await callerToken());
    const { data: rows, error } = await client.from('comments').select('id,user_id,body,created_at,parent_id').eq('post_id',data.postId).eq('kind',data.kind).order('created_at').order('id');
    if (error) throw new Error('댓글을 불러오지 못했습니다.');
    if (!rows.length) return [];
    const { data: postRow } = await client.from('posts').select('user_id,store_id,creator').eq('id',data.postId).maybeSingle();
    const { data: profiles, error: profileError } = await client.rpc('comment_author_profiles', { _post_id: data.postId });
    if (profileError) throw new Error('댓글 프로필을 불러오지 못했습니다.');
    const authors = new Set(rows.map(row => row.user_id));
    const visibleProfiles = (profiles ?? []).filter(profile => authors.has(profile.user_id));
    const paths = [...new Set(visibleProfiles.map(commentAvatarPath).filter((path): path is string => Boolean(path)))];
    const urls = new Map<string, string>();
    if (paths.length) {
      // Only avatar paths authorized against visible published comments can be signed.
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: signed } = await supabaseAdmin.storage.from('avatars').createSignedUrls(paths, 3600);
      signed?.forEach(item => { if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl); });
    }
    const byId = new Map(visibleProfiles.map(profile => [profile.user_id, profile]));
    return rows.map(row => {
      const profile = byId.get(row.user_id);
      const path = profile ? commentAvatarPath(profile) : null;
      const isSeller = Boolean(postRow?.user_id && postRow.user_id === row.user_id);
      const seller = isSeller && postRow ? (postRow.store_id ? postRow.creator : postRow.user_id ?? postRow.creator) : null;
      return { id: row.id, parent_id: row.parent_id, body: row.body, created_at: row.created_at, nickname: isSeller && postRow?.creator ? postRow.creator : commentNickname(profile), seller, avatar_url: path ? urls.get(path) ?? null : null, avatar_key: avatarKey(row.user_id) };
    });
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
  .inputValidator((data: unknown) => z.object({ postId:z.string().max(100), body:z.string().trim().min(1).max(1000), parentId:z.string().uuid().optional(), kind:z.enum(['comment','qna']).default('comment') }).parse(data))
  .handler(async ({data,context}) => {
    const { data: profile, error: profileError } = await context.supabase.from('profiles').select('nickname').eq('user_id',context.userId).maybeSingle();
    if (profileError) throw new Error('프로필을 불러오지 못했습니다.');
    const creator = (profile?.nickname.trim() || 'VELA 회원').slice(0,40);
    const {error} = await context.supabase.from('comments').insert({post_id:data.postId,user_id:context.userId,creator,body:data.body,parent_id:data.parentId ?? null,kind:data.kind});
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

/** Seller header avatar for detail pages: signed store or profile avatar, never a product image. */
export const getSellerAvatar = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ storeId: z.string().uuid().optional(), userId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ data }) => {
    if (!data.storeId && !data.userId) return { avatar: null };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let path: string | null = null, bucket: 'avatars' | 'market-media' = 'avatars';
    if (data.storeId) {
      const { data: store } = await supabaseAdmin.from('stores').select('avatar').eq('id', data.storeId).maybeSingle();
      if (store?.avatar) { path = store.avatar; bucket = 'market-media'; }
    }
    if (!path && data.userId) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('avatar_url').eq('user_id', data.userId).maybeSingle();
      path = profile?.avatar_url ?? null;
    }
    if (!path || path.includes('..') || path.includes('://')) return { avatar: null };
    const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrls([path], 3600);
    return { avatar: signed?.[0]?.signedUrl ?? null };
  });

/** Many seller avatars in one request (feed cards): same rules as getSellerAvatar — store photo first, then profile photo. */
export const getSellerAvatars = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ items: z.array(z.object({ storeId: z.string().uuid().optional(), userId: z.string().uuid().optional() })).min(1).max(60) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const storeIds = [...new Set(data.items.map(i => i.storeId).filter((v): v is string => Boolean(v)))];
    const userIds = [...new Set(data.items.map(i => i.userId).filter((v): v is string => Boolean(v)))];
    const storeAvatar = new Map<string, string>();
    const profileAvatar = new Map<string, string>();
    await Promise.all([
      (async () => { if (!storeIds.length) return; const { data: rows } = await supabaseAdmin.from('stores').select('id,avatar').in('id', storeIds); rows?.forEach(r => { if (r.avatar) storeAvatar.set(r.id, r.avatar); }); })(),
      (async () => { if (!userIds.length) return; const { data: rows } = await supabaseAdmin.from('profiles').select('user_id,avatar_url').in('user_id', userIds); rows?.forEach(r => { if (r.avatar_url) profileAvatar.set(r.user_id, r.avatar_url); }); })(),
    ]);
    const safe = (p: string | null | undefined): p is string => Boolean(p && !p.includes('..') && !p.includes('://'));
    const picked = data.items.map(i => {
      const fromStore = i.storeId ? storeAvatar.get(i.storeId) : undefined;
      if (fromStore) return { path: fromStore, bucket: 'market-media' as const };
      const fromProfile = i.userId ? profileAvatar.get(i.userId) : undefined;
      return { path: fromProfile ?? null, bucket: 'avatars' as const };
    });
    const urls = new Map<string, string>();
    for (const bucket of ['market-media', 'avatars'] as const) {
      const paths = [...new Set(picked.filter(p => p.bucket === bucket && safe(p.path)).map(p => p.path as string))];
      if (!paths.length) continue;
      const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrls(paths, 3600);
      signed?.forEach(item => { if (item.path && item.signedUrl) urls.set(`${bucket}:${item.path}`, item.signedUrl); });
    }
    return picked.map(p => ({ avatar: safe(p.path) ? urls.get(`${p.bucket}:${p.path}`) ?? null : null }));
  });
