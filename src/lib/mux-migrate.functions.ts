import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isExternalVideo } from './mux';

/**
 * Moves videos that were uploaded BEFORE the Mux integration (files in the Supabase "market-media" bucket) to Mux.
 *
 * Nothing is re-uploaded from the browser: the server gives Mux a temporary signed link and Mux fetches the file itself.
 * The post keeps playing its old file until Mux has finished; the webhook then swaps posts.video_url to the HLS URL.
 * The old storage file is NOT deleted, so nothing is lost if a conversion fails (the post just keeps the old video).
 */
type Row = { id: string; video_url: string | null; user_id: string | null };

const isStoragePath = (v: string | null): v is string =>
  Boolean(v && !isExternalVideo(v) && !v.startsWith('seed:') && !/^https?:/i.test(v) && !v.includes('..'));

async function adminContext(supabase: any, userId: string) {
  const { assertAdminRole } = await import('./admin-auth.server');
  await assertAdminRole(supabase, userId);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}

/** Posts whose video is still a storage file, minus those already sent to Mux and still processing. */
async function pendingRows(db: any) {
  const { data: posts, error } = await db.from('posts').select('id,video_url,user_id').not('video_url', 'is', null);
  if (error) throw new Error('게시물을 불러오지 못했어요.');
  const candidates = (posts as Row[]).filter(p => isStoragePath(p.video_url));
  const { data: queued } = await db.from('mux_uploads').select('post_id,source_path').eq('status', 'waiting').not('post_id', 'is', null);
  const busy = new Set(((queued ?? []) as { post_id: string; source_path: string }[]).map(q => `${q.post_id}|${q.source_path}`));
  return candidates.filter(p => !busy.has(`${p.id}|${p.video_url}`));
}

/** How many old videos are left, and how many are being converted right now. */
export const muxMigrationStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminContext(context.supabase, context.userId);
    const left = await pendingRows(db);
    const { count: processing } = await db.from('mux_uploads').select('ref', { count: 'exact', head: true }).eq('status', 'waiting').not('post_id', 'is', null);
    const { count: failed } = await db.from('mux_uploads').select('ref', { count: 'exact', head: true }).eq('status', 'errored').not('post_id', 'is', null);
    return { left: left.length, processing: processing ?? 0, failed: failed ?? 0, configured: Boolean(process.env['MUX_TOKEN_ID'] && process.env['MUX_TOKEN_SECRET'] && process.env['MUX_WEBHOOK_SECRET']) };
  });

/** Sends the next batch (max 10) of old videos to Mux. Call repeatedly until `left` is 0. */
export const migrateVideosToMux = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ limit: z.number().int().min(1).max(10).optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const db = await adminContext(context.supabase, context.userId);
    const tokenId = process.env['MUX_TOKEN_ID'], tokenSecret = process.env['MUX_TOKEN_SECRET'];
    if (!tokenId || !tokenSecret || !process.env['MUX_WEBHOOK_SECRET']) throw new Error('Mux 시크릿이 설정되지 않았어요.');
    const batch = (await pendingRows(db)).slice(0, data.limit ?? 10);
    let sent = 0;
    const errors: string[] = [];
    for (const post of batch) {
      const path = post.video_url as string;
      try {
        const { data: signed, error: signError } = await db.storage.from('market-media').createSignedUrl(path, 6 * 3600);
        if (signError || !signed?.signedUrl) throw new Error('파일 링크를 만들지 못했어요');
        const ref = crypto.randomUUID();
        const res = await fetch('https://api.mux.com/video/v1/assets', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Basic ${btoa(`${tokenId}:${tokenSecret}`)}` },
          body: JSON.stringify({ inputs: [{ url: signed.signedUrl }], playback_policies: ['public'], video_quality: process.env['MUX_VIDEO_QUALITY'] === 'plus' ? 'plus' : 'basic', max_resolution_tier: '1080p', passthrough: ref }),
        });
        if (!res.ok) throw new Error(`Mux ${res.status}`);
        const { data: asset } = (await res.json()) as { data: { id: string } };
        const { error: insertError } = await db.from('mux_uploads').insert({ ref, upload_id: `asset:${asset.id}`, asset_id: asset.id, user_id: post.user_id ?? context.userId, status: 'waiting', post_id: post.id, source_path: path });
        if (insertError) throw new Error('기록을 저장하지 못했어요');
        sent++;
      } catch (e) {
        errors.push(`${post.id}: ${e instanceof Error ? e.message : '실패'}`);
      }
    }
    const left = (await pendingRows(db)).length;
    return { sent, left, errors };
  });
