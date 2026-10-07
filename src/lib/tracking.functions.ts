import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type TrackEvent = { time: string; description: string; location: string };
export type TrackResult = { configured: boolean; status: string; events: TrackEvent[]; checkedAt: string | null; error?: string };

const REFRESH_MS = 10 * 60 * 1000;

function parse(info: unknown): { status: string; events: TrackEvent[] } {
  const ti = (info ?? {}) as Record<string, any>;
  const providers: any[] = ti?.tracking?.providers ?? [];
  const events: TrackEvent[] = providers.flatMap(p => (p?.events ?? []).map((e: any) => ({
    time: String(e?.time_iso ?? e?.time_utc ?? ''),
    description: String(e?.description ?? ''),
    location: String(e?.location ?? ''),
  }))).slice(0, 40);
  return { status: String(ti?.latest_status?.status ?? (events.length ? 'InTransit' : 'NotFound')), events };
}

/** Live courier status via 17TRACK. Readable only by order parties (RLS); cached 10 min. */
export const getOrderTracking = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<TrackResult> => {
    const { data: order, error } = await context.supabase.from('orders')
      .select('id,tracking_number,tracking_status,tracking_checked_at').eq('id', data.orderId).maybeSingle();
    if (error || !order) throw new Error('Order not found');
    const cached = (order.tracking_status ?? {}) as { status?: string; events?: TrackEvent[] };
    const key = process.env['TRACK17_API_KEY'];
    const base = { status: cached.status ?? 'Pending', events: cached.events ?? [], checkedAt: order.tracking_checked_at };
    if (!key) return { configured: false, ...base };
    if (!order.tracking_number) return { configured: true, ...base };
    const fresh = order.tracking_checked_at && Date.now() - new Date(order.tracking_checked_at).getTime() < REFRESH_MS;
    if (fresh && !data.force) return { configured: true, ...base };
    try {
      const headers = { '17token': key, 'content-type': 'application/json' };
      const body = JSON.stringify([{ number: order.tracking_number }]);
      await fetch('https://api.17track.net/track/v2.2/register', { method: 'POST', headers, body });
      const res = await fetch('https://api.17track.net/track/v2.2/gettrackinfo', { method: 'POST', headers, body });
      const json: any = await res.json();
      const parsed = parse(json?.data?.accepted?.[0]?.track_info);
      const checkedAt = new Date().toISOString();
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      await supabaseAdmin.from('orders').update({ tracking_status: parsed, tracking_checked_at: checkedAt }).eq('id', order.id);
      return { configured: true, ...parsed, checkedAt };
    } catch (e) {
      console.error('17track error', e);
      return { configured: true, ...base, error: '배송 정보를 잠시 불러오지 못했습니다.' };
    }
  });
