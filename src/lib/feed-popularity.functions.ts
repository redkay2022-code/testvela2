import { createServerFn } from '@tanstack/react-start';

export type FeedPopularity = Record<string, { views: number; likes: number }>;

/**
 * How many product views (last 14 days, from the visit counter) and likes each product has.
 * Used only to nudge the Home order. Shared by everyone and cached for 10 minutes; if the visit table or the
 * query is unavailable it returns an empty result and the feed simply orders without popularity.
 */
let cache: { at: number; data: FeedPopularity } | null = null;
let loading: Promise<FeedPopularity> | null = null;

async function load(): Promise<FeedPopularity> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const db = supabaseAdmin as any;
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const views = async () => {
    const withDate = await db.from('page_views').select('post_id').eq('kind', 'product').not('post_id', 'is', null).gte('created_at', since).limit(30000);
    if (!withDate.error) return withDate.data ?? [];
    const plain = await db.from('page_views').select('post_id').eq('kind', 'product').not('post_id', 'is', null).limit(30000);
    return plain.error ? [] : plain.data ?? [];
  };
  const [viewRows, likeRes] = await Promise.all([views(), db.from('likes').select('post_id').limit(30000)]);
  const out: FeedPopularity = {};
  for (const r of viewRows as { post_id: string }[]) if (r.post_id) (out[r.post_id] ??= { views: 0, likes: 0 }).views++;
  for (const r of (likeRes.error ? [] : likeRes.data ?? []) as { post_id: string }[]) if (r.post_id) (out[r.post_id] ??= { views: 0, likes: 0 }).likes++;
  return out;
}

export const getFeedPopularity = createServerFn({ method: 'GET' }).handler(async (): Promise<FeedPopularity> => {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.data;
  loading ??= load().then(data => { cache = { at: Date.now(), data }; return data; }).catch(() => ({} as FeedPopularity)).finally(() => { loading = null; });
  return loading;
});
