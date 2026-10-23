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

/**
 * 편집용 원본(MP4) 준비: Mux에 올린 영상은 스트리밍(.m3u8)이라 파일로 받을 수 없어서, 편집을 열 때 MP4 사본을 만들어 달라고 Mux에 요청한다.
 * 처음 한 번만 준비 시간이 걸리고(보통 수십 초), 준비되면 ready: true 와 내려받을 주소를 돌려준다.
 */
export const prepareMuxEditSource = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { videoUrl: string }) => input)
  .handler(async ({ data, context }) => {
    const tokenId = process.env['MUX_TOKEN_ID'];
    const tokenSecret = process.env['MUX_TOKEN_SECRET'];
    if (!tokenId || !tokenSecret) throw new Error('영상 편집 준비를 할 수 없어요. 영상을 다시 선택해 주세요.');
    const [{ data: seller }, { data: admin }] = await Promise.all([
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'seller' }),
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
    ]);
    if (!seller && !admin) throw new Error('승인된 셀러만 영상을 편집할 수 있어요.');
    const m = /^https:\/\/stream\.mux\.com\/([A-Za-z0-9]{8,80})\.m3u8$/.exec(data.videoUrl);
    if (!m || !m[1]) throw new Error('Mux 영상 주소가 아니에요.');
    const playbackId = m[1];
    const headers = { 'content-type': 'application/json', authorization: `Basic ${btoa(`${tokenId}:${tokenSecret}`)}` };
    const pb = await fetch(`https://api.mux.com/video/v1/playback-ids/${playbackId}`, { headers });
    if (!pb.ok) throw new Error('영상 정보를 찾지 못했어요.');
    const assetId = ((await pb.json()) as { data?: { object?: { id?: string } } }).data?.object?.id;
    if (!assetId) throw new Error('영상 정보를 찾지 못했어요.');
    type Files = { name?: string; status?: string; resolution?: string; ext?: string }[];
    const readAsset = async () => {
      const r = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, { headers });
      if (!r.ok) throw new Error('영상 정보를 불러오지 못했어요.');
      const d = ((await r.json()) as { data?: { static_renditions?: { files?: Files }; mp4_support?: string } }).data;
      return d?.static_renditions?.files ?? [];
    };
    let files = await readAsset();
    const pick = (f: Files) => f.find(x => x.status === 'ready' && (x.ext === 'mp4' || /\.mp4$/.test(x.name ?? '')));
    let ready = pick(files);
    if (!ready && !files.some(x => x.status === 'preparing' || x.status === 'creating')) {
      const res = await fetch(`https://api.mux.com/video/v1/assets/${assetId}/static-renditions`, { method: 'POST', headers, body: JSON.stringify({ resolution: 'highest' }) });
      if (!res.ok && res.status !== 409 && res.status !== 400) { console.error('mux static rendition failed', res.status, await res.text().catch(() => '')); throw new Error('편집용 영상을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
      files = await readAsset(); ready = pick(files);
    }
    return ready ? { ready: true as const, url: `https://stream.mux.com/${playbackId}/${ready.name ?? 'highest.mp4'}` } : { ready: false as const, url: '' };
  });
