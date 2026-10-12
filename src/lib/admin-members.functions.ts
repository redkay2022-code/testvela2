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

// ------------------------------------------------------------------ reset (members / posts)
export type ResetScope = 'posts' | 'members' | 'all';
export type ResetPreview = { members: number; posts: number; orders: number; reviews: number; comments: number; admins: number };

async function adminIds(db: any): Promise<string[]> {
  const { data, error } = await db.from('user_roles').select('user_id').eq('role', 'admin');
  if (error) throw new Error('관리자 목록을 확인하지 못했습니다.');
  return [...new Set<string>((data ?? []).map((r: any) => r.user_id))];
}
const notIn = (ids: string[]) => `(${ids.join(',')})`;

/** Shows how much data a reset would remove. Admin accounts are never counted as members. */
export const adminResetPreview = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResetPreview> => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb(), admins = await adminIds(db);
    const count = async (table: string, f?: (q: any) => any) => {
      let q = db.from(table).select('*', { count: 'exact', head: true });
      if (f) q = f(q);
      const { count: n, error } = await q;
      return error ? 0 : n ?? 0;
    };
    const [profiles, posts, orders, reviews, comments] = await Promise.all([
      count('profiles', q => q.not('user_id', 'in', notIn(admins))), count('posts'), count('orders'), count('reviews'), count('comments'),
    ]);
    return { members: profiles, posts, orders, reviews, comments, admins: admins.length };
  });

const MEMBER_BATCH = 10; // keeps every request small enough for the hosting platform's per-request limits

async function removeFiles(db: any, bucket: string, paths: (string | null | undefined)[]) {
  const clean = [...new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0 && !p.startsWith('seed:') && !/^https?:/i.test(p) && !p.includes('..')))];
  let removed = 0;
  for (let i = 0; i < clean.length; i += 100) {
    const { error } = await db.storage.from(bucket).remove(clean.slice(i, i + 100));
    if (!error) removed += Math.min(100, clean.length - i);
  }
  return removed;
}
async function selectAll(db: any, table: string, cols: string, f?: (q: any) => any, orderCol?: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    let q = db.from(table).select(cols);
    if (f) q = f(q);
    if (orderCol) q = q.order(orderCol);
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table} 목록을 읽지 못했습니다.`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Wipes test data. Admin accounts are always kept. The admin must re-enter their password and type 초기화.
 *  posts   → every listing + photos/videos, comments, likes, orders, QC media, reviews
 *  members → every non-admin account and everything it owns
 *  all     → both, plus the visit statistics
 * Two phases keep each request small: 'data' removes content, then 'accounts' is repeated (10 members at a time) until `remainingMembers` is 0.
 */
export const adminResetData = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ scope: z.enum(['posts', 'members', 'all']), confirm: z.literal('초기화'), password: z.string().max(72).optional(), token: z.string().max(200).optional(), phase: z.enum(['data', 'accounts']) }).parse(d))
  .handler(async ({ context, data }): Promise<{ lines: string[]; deletedMembers: number; remainingMembers: number; warnings: string[]; token?: string }> => {
    const auth = await import('./admin-auth.server');
    // The password is checked once ('data' phase); the repeated 'accounts' calls carry a 10-minute signed token instead.
    if (data.phase === 'data') {
      if (!data.password) throw new Error('비밀번호를 입력해 주세요.');
      await auth.checkAdminPassword(context.supabase, context.userId, data.password);
    } else {
      await auth.assertAdminRole(context.supabase, context.userId);
      if (!(await auth.verifyResetToken(context.userId, data.scope, data.token))) throw new Error('확인 시간이 지났습니다. 처음부터 다시 실행해 주세요.');
    }
    const db = await adminDb(), admins = await adminIds(db);
    if (!admins.includes(context.userId)) throw new Error('관리자 계정을 확인하지 못해 중단했습니다.');
    const lines: string[] = [], warnings: string[] = [];
    const wipe = async (label: string, table: string, f: (q: any) => any) => {
      const { error, count } = await f(db.from(table).delete({ count: 'exact' }));
      if (error) { warnings.push(`${label}: ${error.message}`); return 0; }
      return count ?? 0;
    };
    const chunks = <T,>(a: T[], n = 100) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
    const doPosts = data.scope === 'posts' || data.scope === 'all';
    const doMembers = data.scope === 'members' || data.scope === 'all';
    const others = (col: string) => (q: any) => q.not(col, 'in', notIn(admins));

    /** orders (+ everything attached to them) selected by `pick`. */
    const dropOrders = async (pick: (q: any) => any) => {
      const orders = await selectAll(db, 'orders', 'id', pick, 'id');
      const ids: string[] = orders.map(o => o.id);
      for (const part of chunks(ids)) {
        const qc = await selectAll(db, 'order_qc_media', 'path', q => q.in('order_id', part), 'id');
        await removeFiles(db, 'qc-media', qc.map(r => r.path));
        for (const t of ['order_replacements', 'order_messages', 'order_qc_media', 'payment_transactions']) await wipe(t, t, q => q.in('order_id', part));
        await wipe('orders', 'orders', q => q.in('id', part));
      }
      return ids.length;
    };
    const dropPosts = async (pick?: (q: any) => any) => {
      const posts = await selectAll(db, 'posts', 'id, media_urls, video_url, thumbnail_url', pick, 'id');
      for (const part of chunks(posts)) {
        const ids = part.map(p => p.id);
        const imgs = await selectAll(db, 'product_images', 'path', q => q.in('post_id', ids), 'id');
        await removeFiles(db, 'market-media', [...part.flatMap(p => [...(p.media_urls ?? []), p.video_url, p.thumbnail_url]), ...imgs.map(i => i.path)]);
        await wipe('posts', 'posts', q => q.in('id', ids));
      }
      return posts.length;
    };
    const dropReviews = async (pick?: (q: any) => any) => {
      const rows = await selectAll(db, 'reviews', 'id, media_urls, video_url', pick, 'id');
      for (const part of chunks(rows)) {
        await removeFiles(db, 'review-media', part.flatMap(r => [...(r.media_urls ?? []), r.video_url]));
        await wipe('reviews', 'reviews', q => q.in('id', part.map(r => r.id)));
      }
      return rows.length;
    };

    if (data.phase === 'data' && doPosts) {
      lines.push(`주문·정산·QC 기록 ${await dropOrders(q => q.not('id', 'is', null))}건`);
      lines.push(`리뷰 ${await dropReviews()}건`);
      lines.push(`상품(게시물) ${await dropPosts()}건 (사진·영상 파일 포함)`);
      await wipe('likes', 'likes', q => q.not('post_id', 'is', null));
      await wipe('cart_items', 'cart_items', q => q.not('post_id', 'is', null));
      await wipe('comments', 'comments', q => q.not('id', 'is', null));
    }

    let remaining = 0, deletedCount = 0;
    if (data.phase === 'data' && doMembers) {
      if (!doPosts) {
        lines.push(`회원의 주문·정산 기록 ${await dropOrders(q => q.or(`buyer_id.not.in.${notIn(admins)},seller_id.not.in.${notIn(admins)}`))}건`);
        lines.push(`회원의 리뷰 ${await dropReviews(others('user_id'))}건`);
        lines.push(`회원의 상품 ${await dropPosts(others('user_id'))}건`);
      }
      for (const [t, col] of [['comments', 'user_id'], ['likes', 'user_id'], ['cart_items', 'user_id'], ['notifications', 'user_id'], ['saved_shipping', 'user_id'], ['seller_follows', 'follower_id'], ['point_transactions', 'user_id'], ['point_wallets', 'user_id'], ['memberships', 'user_id'], ['seller_applications', 'user_id'], ['wechat_identities', 'user_id'], ['user_sanctions', 'user_id'], ['page_views', 'user_id'], ['seller_tier_overrides', 'seller_id']] as const)
        await wipe(t, t, others(col));
    }
    if (data.phase === 'data' && data.scope === 'all') { await wipe('page_views', 'page_views', q => q.not('id', 'is', null)); lines.push('방문 통계 초기화'); }
    if (data.phase === 'accounts' && doMembers) {
      // accounts: list everyone, keep admins, delete one batch per call
      const everyone: { id: string }[] = [];
      for (let page = 1; page <= 50; page++) {
        const { data: list, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error('회원 목록을 불러오지 못했습니다.');
        everyone.push(...(list?.users ?? []));
        if ((list?.users?.length ?? 0) < 200) break;
      }
      const targets = everyone.filter(u => !admins.includes(u.id)).map(u => u.id);
      const batch = targets.slice(0, MEMBER_BATCH);
      const profiles = batch.length ? await selectAll(db, 'profiles', 'user_id, avatar_url', q => q.in('user_id', batch), 'user_id') : [];
      await removeFiles(db, 'avatars', profiles.map(p => p.avatar_url));
      let deleted = 0;
      for (const id of batch) {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error) warnings.push(`회원 삭제 실패: ${error.message}`); else deleted++;
      }
      if (batch.length) await wipe('seller_follows', 'seller_follows', q => q.in('seller_key', batch));
      remaining = Math.max(0, targets.length - deleted); deletedCount = deleted;
    }
    return { lines, deletedMembers: deletedCount, remainingMembers: remaining, warnings, ...(data.phase === 'data' ? { token: await auth.signResetToken(context.userId, data.scope) } : {}) };
  });

/**
 * Permanently deletes one non-admin member: their account (sign-in + phone hash) and the content they own.
 * Order records stay for escrow/accounting history. The same phone number can sign up again afterwards.
 */
export const adminDeleteMember = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ userId: z.string().uuid(), password: z.string().min(1).max(72) }).parse(d))
  .handler(async ({ context, data }) => {
    const auth = await import('./admin-auth.server');
    await auth.checkAdminPassword(context.supabase, context.userId, data.password);
    if (data.userId === context.userId) throw new Error('자기 자신은 삭제할 수 없습니다.');
    const db = await adminDb();
    const { data: isAdmin } = await db.rpc('has_role', { _user_id: data.userId, _role: 'admin' });
    if (isAdmin) throw new Error('관리자 계정은 삭제할 수 없습니다.');
    const id = data.userId;
    const { data: prof } = await db.from('profiles').select('avatar_url').eq('user_id', id).maybeSingle();
    const { data: posts } = await db.from('posts').select('id, media_urls, video_url, thumbnail_url').eq('user_id', id);
    const files = (posts ?? []).flatMap((p: any) => [...(p.media_urls ?? []), p.video_url, p.thumbnail_url]).filter((p: unknown): p is string => typeof p === 'string' && !!p && !p.startsWith('seed:') && !/^https?:/i.test(p) && !p.includes('..'));
    const del = (t: string, col: string, v: string) => db.from(t).delete().eq(col, v);
    await Promise.all([del('likes', 'user_id', id), del('cart_items', 'user_id', id), del('seller_follows', 'follower_id', id), del('seller_follows', 'seller_key', id), del('notifications', 'user_id', id), del('saved_shipping', 'user_id', id), del('seller_applications', 'user_id', id), del('user_sanctions', 'user_id', id)]);
    await db.from('comments').delete().eq('user_id', id).not('parent_id', 'is', null);
    await del('comments', 'user_id', id);
    await del('reviews', 'user_id', id);
    if (posts?.length) { await db.from('posts').delete().eq('user_id', id); for (let i = 0; i < files.length; i += 100) await db.storage.from('market-media').remove(files.slice(i, i + 100)); }
    if (prof?.avatar_url && !/^https?:/i.test(prof.avatar_url)) await db.storage.from('avatars').remove([prof.avatar_url]);
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw new Error(`회원을 삭제하지 못했습니다: ${error.message}`);
    await db.from('profiles').delete().eq('user_id', id);
    return { ok: true };
  });

// ------------------------------------------------------------------ review moderation
export type AdminReviewRow = { id: string; nickname: string; seller_name: string; body: string; rating: number | null; held: boolean; created_at: string; media: number };

export const adminListReviews = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ page: z.number().int().min(0).max(1000).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }): Promise<{ rows: AdminReviewRow[]; total: number; pageSize: number }> => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb(), size = 20, page = data.page ?? 0;
    const { data: rows, count, error } = await db.from('reviews').select('id, nickname, seller_name, body, rating, held, created_at, media_urls, video_url', { count: 'exact' }).order('created_at', { ascending: false }).range(page * size, page * size + size - 1);
    if (error) throw new Error('리뷰를 불러오지 못했습니다.');
    return { rows: (rows ?? []).map((r: any) => ({ id: r.id, nickname: r.nickname, seller_name: r.seller_name, body: r.body, rating: r.rating, held: !!r.held, created_at: r.created_at, media: (r.media_urls?.length ?? 0) + (r.video_url ? 1 : 0) })), total: count ?? 0, pageSize: size };
  });

export const adminHoldReview = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ id: z.string().uuid(), held: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const { error } = await db.from('reviews').update({ held: data.held }).eq('id', data.id);
    if (error) throw new Error('보류 상태를 바꾸지 못했습니다.');
    return { ok: true };
  });

export const adminDeleteReview = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ id: z.string().uuid(), password: z.string().min(1).max(72) }).parse(d))
  .handler(async ({ context, data }) => {
    const auth = await import('./admin-auth.server');
    await auth.checkAdminPassword(context.supabase, context.userId, data.password);
    const db = await adminDb();
    const { data: r } = await db.from('reviews').select('media_urls, video_url').eq('id', data.id).maybeSingle();
    if (!r) throw new Error('이미 삭제된 리뷰입니다.');
    const { error } = await db.from('reviews').delete().eq('id', data.id);
    if (error) throw new Error('리뷰를 삭제하지 못했습니다.');
    const files = [...(r.media_urls ?? []), r.video_url].filter((p: unknown): p is string => typeof p === 'string' && !!p && !/^https?:/i.test(p) && !p.includes('..'));
    if (files.length) await db.storage.from('review-media').remove(files);
    return { ok: true };
  });
