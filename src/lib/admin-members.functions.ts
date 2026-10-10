import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** The generated DB types do not know the new tables yet, so the admin client is used untyped here. */
async function adminDb() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin as any;
}
async function requireAdmin(supabase: any, userId: string) {
  const mod = await import('./admin-auth.server');
  await mod.assertAdminRole(supabase, userId);
}

export type MemberRow = {
  user_id: string; nickname: string; system_code: string; created_at: string; last_sign_in_at: string | null;
  roles: string[]; comments: number; orders: number;
  sanction: { id: string; kind: 'suspend' | 'ban'; reason: string; ends_at: string | null } | null;
};

export const adminListMembers = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ q: z.string().max(60).optional(), page: z.number().int().min(0).max(1000).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }): Promise<{ rows: MemberRow[]; total: number; pageSize: number }> => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb(), size = 20, page = data.page ?? 0;
    let q = db.from('profiles').select('user_id, nickname, system_code, created_at', { count: 'exact' }).order('created_at', { ascending: false });
    const term = (data.q ?? '').trim().replace(/[%,()]/g, '');
    if (term) q = q.or(`nickname.ilike.%${term}%,system_code.ilike.%${term}%`);
    const { data: profiles, count, error } = await q.range(page * size, page * size + size - 1);
    if (error) throw new Error('회원 목록을 불러오지 못했습니다.');
    const ids: string[] = (profiles ?? []).map((p: any) => p.user_id);
    if (!ids.length) return { rows: [], total: count ?? 0, pageSize: size };
    const [roles, sanctions, comments, orders, auths] = await Promise.all([
      db.from('user_roles').select('user_id, role').in('user_id', ids),
      db.from('user_sanctions').select('id, user_id, kind, reason, ends_at').in('user_id', ids).is('lifted_at', null).lte('starts_at', new Date().toISOString()).order('created_at', { ascending: false }),
      db.from('comments').select('user_id').in('user_id', ids).limit(5000),
      db.from('orders').select('buyer_id').in('buyer_id', ids).limit(5000),
      Promise.all(ids.map(async id => { try { const { data: u } = await db.auth.admin.getUserById(id); return [id, u?.user?.last_sign_in_at ?? null] as const; } catch { return [id, null] as const; } })),
    ]);
    const tally = (rows: any[] | null, key: string) => { const m = new Map<string, number>(); for (const r of rows ?? []) m.set(r[key], (m.get(r[key]) ?? 0) + 1); return m; };
    const cm = tally(comments.data, 'user_id'), om = tally(orders.data, 'buyer_id'), seen = new Map(auths);
    const now = Date.now();
    const rows: MemberRow[] = (profiles ?? []).map((p: any) => {
      const s = (sanctions.data ?? []).find((x: any) => x.user_id === p.user_id && (!x.ends_at || new Date(x.ends_at).getTime() > now));
      return { user_id: p.user_id, nickname: p.nickname, system_code: p.system_code, created_at: p.created_at, last_sign_in_at: seen.get(p.user_id) ?? null,
        roles: (roles.data ?? []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role), comments: cm.get(p.user_id) ?? 0, orders: om.get(p.user_id) ?? 0,
        sanction: s ? { id: s.id, kind: s.kind, reason: s.reason, ends_at: s.ends_at } : null };
    });
    return { rows, total: count ?? 0, pageSize: size };
  });

const DAYS = { '7d': 7, '15d': 15, '30d': 30 } as const;

export const adminSanctionMember = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ userId: z.string().uuid(), action: z.enum(['7d', '15d', '30d', 'ban']), reason: z.string().trim().min(2).max(300), password: z.string().min(1).max(72) }).parse(d))
  .handler(async ({ context, data }) => {
    const auth = await import('./admin-auth.server');
    await auth.checkAdminPassword(context.supabase, context.userId, data.password);
    if (data.userId === context.userId) throw new Error('자기 자신은 제재할 수 없습니다.');
    const db = await adminDb();
    const { data: isAdmin } = await db.rpc('has_role', { _user_id: data.userId, _role: 'admin' });
    if (isAdmin) throw new Error('관리자 계정은 제재할 수 없습니다.');
    const now = new Date();
    const ends = data.action === 'ban' ? null : new Date(now.getTime() + DAYS[data.action] * 86_400_000);
    await db.from('user_sanctions').update({ lifted_at: now.toISOString() }).eq('user_id', data.userId).is('lifted_at', null);
    const { error } = await db.from('user_sanctions').insert({ user_id: data.userId, kind: data.action === 'ban' ? 'ban' : 'suspend', reason: data.reason, starts_at: now.toISOString(), ends_at: ends?.toISOString() ?? null, created_by: context.userId });
    if (error) throw new Error('제재를 저장하지 못했습니다.');
    if (data.action === 'ban') await db.auth.admin.updateUserById(data.userId, { ban_duration: '876000h' });
    await db.from('notifications').insert({ user_id: data.userId, kind: 'sanction', title: data.action === 'ban' ? 'Account permanently suspended' : `Account suspended (${DAYS[data.action]} days)`, body: `Reason: ${data.reason}${ends ? ` · Until ${ends.toISOString().slice(0, 10)}` : ''}` });
    return { ok: true };
  });

export const adminLiftSanction = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ userId: z.string().uuid(), password: z.string().min(1).max(72) }).parse(d))
  .handler(async ({ context, data }) => {
    const auth = await import('./admin-auth.server');
    await auth.checkAdminPassword(context.supabase, context.userId, data.password);
    const db = await adminDb();
    await db.from('user_sanctions').update({ lifted_at: new Date().toISOString() }).eq('user_id', data.userId).is('lifted_at', null);
    await db.auth.admin.updateUserById(data.userId, { ban_duration: 'none' });
    return { ok: true };
  });

/** Permanently removes a listing and its photos/videos. The admin must re-enter their password. */
export const adminDeletePost = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ postId: z.string().min(1).max(100), password: z.string().min(1).max(72) }).parse(d))
  .handler(async ({ context, data }) => {
    const auth = await import('./admin-auth.server');
    await auth.checkAdminPassword(context.supabase, context.userId, data.password);
    const db = await adminDb();
    const { data: post } = await db.from('posts').select('id, media_urls, video_url, thumbnail_url').eq('id', data.postId).maybeSingle();
    if (!post) throw new Error('이미 삭제되었거나 찾을 수 없는 상품입니다.');
    const { error } = await db.from('posts').delete().eq('id', data.postId);
    if (error) throw new Error('상품을 삭제하지 못했습니다.');
    const files = [...(post.media_urls ?? []), post.video_url, post.thumbnail_url].filter((p: unknown): p is string => typeof p === 'string' && p.length > 0 && !p.startsWith('seed:') && !p.startsWith('http') && !p.includes('..'));
    if (files.length) await db.storage.from('market-media').remove(files);
    return { ok: true };
  });

// ------------------------------------------------------------------ visit tracking
const hits = new Map<string, { n: number; at: number }>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const trackView = createServerFn({ method: 'POST' })
  .inputValidator(d => z.object({
    visitorId: z.string().min(8).max(64), sessionId: z.string().min(8).max(64), kind: z.enum(['page', 'product', 'store']),
    path: z.string().max(200), postId: z.string().max(100).optional(), sellerKey: z.string().max(100).optional(), source: z.string().max(40).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const now = Date.now(), h = hits.get(data.sessionId);
    if (h && now - h.at < 60_000) { if (h.n >= 40) return { ok: false }; h.n++; } else hits.set(data.sessionId, { n: 1, at: now });
    if (hits.size > 5000) hits.clear();
    const { getRequestHeader } = await import('@tanstack/react-start/server');
    const raw = (getRequestHeader('cf-ipcountry') || getRequestHeader('x-vercel-ip-country') || '').toUpperCase();
    const country = /^[A-Z]{2}$/.test(raw) && raw !== 'XX' && raw !== 'T1' ? raw : null;
    const db = await adminDb();
    let sellerId: string | null = null;
    if (data.postId) { const { data: p } = await db.from('posts').select('user_id').eq('id', data.postId).maybeSingle(); sellerId = p?.user_id ?? null; }
    else if (data.sellerKey && UUID.test(data.sellerKey)) sellerId = data.sellerKey;
    let userId: string | null = null;
    const bearer = (getRequestHeader('authorization') ?? '').replace(/^Bearer /, '');
    if (bearer) {
      const { data: u } = await db.auth.getUser(bearer);
      userId = u?.user?.id ?? null;
      if (userId) {
        if (userId === sellerId) return { ok: true };
        const { data: isAdmin } = await db.rpc('has_role', { _user_id: userId, _role: 'admin' });
        if (isAdmin) return { ok: true };
      }
    }
    await db.from('page_views').insert({ visitor_id: data.visitorId, session_id: data.sessionId, user_id: userId, kind: data.kind, path: data.path, post_id: data.postId ?? null, seller_id: sellerId, country, source: data.source || 'direct' });
    return { ok: true };
  });
