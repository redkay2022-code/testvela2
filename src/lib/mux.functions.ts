import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { muxPending } from './mux';

/**
 * Creates a one-time Mux "direct upload" URL for a seller's listing video.
 *
 * Returns { enabled: false } when the Mux secrets are not configured, so the app keeps using the old
 * Supabase Storage upload until MUX_TOKEN_ID / MUX_TOKEN_SECRET / MUX_WEBHOOK_SECRET are added.
 */
export const createMuxUpload = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tokenId = process.env['MUX_TOKEN_ID'];
    const tokenSecret = process.env['MUX_TOKEN_SECRET'];
    if (!tokenId || !tokenSecret || !process.env['MUX_WEBHOOK_SECRET']) return { enabled: false as const };

    // Only approved sellers and admins may create uploads (each upload is billable Mux usage).
    const [{ data: seller }, { data: admin }] = await Promise.all([
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'seller' }),
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
    ]);
    if (!seller && !admin) throw new Error('승인된 셀러만 영상을 올릴 수 있어요.');

    const { getRequestHeader } = await import('@tanstack/react-start/server');
    const origin = getRequestHeader('origin') || '*';
    const ref = crypto.randomUUID();

    const res = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${btoa(`${tokenId}:${tokenSecret}`)}`,
      },
      body: JSON.stringify({
        cors_origin: origin,
        new_asset_settings: {
          playback_policies: ['public'],
          // "basic" has no encoding charge. Switch to "plus" for higher quality at an encoding cost.
          video_quality: process.env['MUX_VIDEO_QUALITY'] === 'plus' ? 'plus' : 'basic',
          max_resolution_tier: '1080p',
          passthrough: ref,
        },
      }),
    });
    if (!res.ok) {
      console.error('mux upload create failed', res.status, await res.text().catch(() => ''));
      throw new Error('영상 업로드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    const { data } = (await res.json()) as { data: { id: string; url: string } };

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('mux_uploads').insert({ ref, upload_id: data.id, user_id: context.userId, status: 'waiting' });
    if (error) {
      console.error('mux_uploads insert failed', error.message);
      throw new Error('영상 업로드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    return { enabled: true as const, uploadUrl: data.url, videoUrl: muxPending(ref) };
  });
