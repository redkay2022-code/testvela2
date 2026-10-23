import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isMuxStreamUrl, muxThumbnailUrl } from './mux';

/**
 * Fresh thumbnail addresses for the products on the caller's own orders.
 * The address saved on an order is a time-limited link that has long expired, so the QC board asks for a new one here.
 * Only products that appear on orders the caller can read (buyer, seller or admin) are returned.
 */
export const getOrderThumbs = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ postIds: z.array(z.string().min(1).max(120)).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const out: Record<string, string> = {};
    if (!data.postIds.length) return out;
    const orders = await context.supabase.from('orders').select('post_id').in('post_id', data.postIds);
    const allowed = [...new Set((orders.data ?? []).map(o => o.post_id).filter((x): x is string => Boolean(x)))];
    if (!allowed.length) return out;
    const posts = await context.supabase.from('posts').select('id,media_urls,thumbnail_url,video_url,specs').in('id', allowed);
    if (posts.error || !posts.data) return out;
    const pending = new Map<string, string>(); // post id -> storage path to sign
    for (const p of posts.data) {
      const specs = p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs) ? p.specs as Record<string, unknown> : {};
      const card = typeof specs['cardImage'] === 'string' ? specs['cardImage'] as string : null;
      /* 셀러가 직접 고른 영상 썸네일이 있으면 Mux 자동 썸네일보다 우선한다. */
      const custom = specs['customThumb'] === 'true' && p.video_url && p.thumbnail_url ? p.thumbnail_url : null;
      if (isMuxStreamUrl(p.video_url) && !custom) { out[p.id] = muxThumbnailUrl(p.video_url); continue; }
      const path = [custom, card, p.media_urls?.[0], p.thumbnail_url].find((x): x is string => Boolean(x) && !x!.startsWith('seed:') && !x!.includes('..'));
      if (!path) continue;
      if (/^https?:\/\//.test(path)) out[p.id] = path; else pending.set(p.id, path);
    }
    if (pending.size) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const paths = [...new Set(pending.values())];
      const signed = await supabaseAdmin.storage.from('market-media').createSignedUrls(paths, 3600);
      const urls = new Map<string, string>();
      signed.data?.forEach(s => { if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl); });
      for (const [id, path] of pending) { const u = urls.get(path); if (u) out[id] = u; }
    }
    return out;
  });
