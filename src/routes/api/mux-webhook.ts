import { createFileRoute } from '@tanstack/react-router';
import { muxPending, muxStreamUrl } from '@/lib/mux';

/**
 * Mux → VELA webhook. Register https://<your-domain>/api/mux-webhook in the Mux dashboard (Settings → Webhooks)
 * and store its signing secret as MUX_WEBHOOK_SECRET.
 *
 * video.asset.ready   → remember the playback id and switch every post that waits for this upload to the HLS URL.
 * video.asset.errored → mark the upload as failed (the post keeps its thumbnail and shows no video).
 */
const TOLERANCE_SECONDS = 300;

async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => { const i = p.indexOf('='); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));
  const t = parts['t'], v1 = parts['v1'];
  if (!t || !v1 || !/^\d+$/.test(t)) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const expected = new TextEncoder().encode(createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex'));
  const given = new TextEncoder().encode(v1.toLowerCase());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type MuxEvent = {
  type?: string;
  data?: { id?: string; passthrough?: string; upload_id?: string; playback_ids?: { id: string; policy: string }[] };
};

async function handle(request: Request): Promise<Response> {
  const secret = process.env['MUX_WEBHOOK_SECRET'];
  if (!secret) return new Response('not configured', { status: 503 });
  const raw = await request.text();
  if (!(await verifySignature(raw, request.headers.get('mux-signature'), secret))) return new Response('bad signature', { status: 401 });

  let event: MuxEvent;
  try { event = JSON.parse(raw) as MuxEvent; } catch { return new Response('bad json', { status: 400 }); }
  const ref = event.data?.passthrough;
  if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) return new Response('ignored', { status: 200 });

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const now = new Date().toISOString();

  if (event.type === 'video.asset.ready') {
    const playbackId = event.data?.playback_ids?.find(p => p.policy === 'public')?.id;
    if (!playbackId) return new Response('no public playback id', { status: 200 });
    const { error: upErr } = await supabaseAdmin.from('mux_uploads')
      .update({ asset_id: event.data?.id ?? null, playback_id: playbackId, status: 'ready', updated_at: now })
      .eq('ref', ref);
    if (upErr) { console.error('mux webhook: mux_uploads update failed', upErr.message); return new Response('retry', { status: 500 }); }
    // Posts saved before the video was ready still hold the placeholder: swap it now.
    const { error: postErr } = await supabaseAdmin.from('posts').update({ video_url: muxStreamUrl(playbackId) }).eq('video_url', muxPending(ref));
    if (postErr) { console.error('mux webhook: posts update failed', postErr.message); return new Response('retry', { status: 500 }); }
  } else if (event.type === 'video.asset.errored') {
    await supabaseAdmin.from('mux_uploads').update({ asset_id: event.data?.id ?? null, status: 'errored', updated_at: now }).eq('ref', ref);
  }
  return new Response('ok', { status: 200 });
}

export const Route = createFileRoute('/api/mux-webhook')({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
