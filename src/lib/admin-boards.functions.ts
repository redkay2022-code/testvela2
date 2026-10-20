import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** 관리자용 전체 게시판 열람/답변. 모든 함수는 관리자 권한을 먼저 확인합니다. */
async function adminDb() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin as any;
}
async function requireAdmin(supabase: any, userId: string) {
  const mod = await import('./admin-auth.server');
  await mod.assertAdminRole(supabase, userId);
}

export type BoardReply = { id: string; body: string; creator: string; created_at: string; by_seller: boolean };
export type QnaRow = {
  id: string; post_id: string; post_title: string; seller_id: string | null; seller_name: string;
  author: string; body: string; created_at: string; answered: boolean; canReply: boolean; replies: BoardReply[];
};
export type NoticeRow = { id: string; seller_id: string; seller_name: string; title: string; body: string; created_at: string };

export const adminListQna = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pendingOnly: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }): Promise<QnaRow[]> => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const { data: parents, error } = await db.from('comments').select('id,post_id,user_id,creator,body,created_at').is('parent_id', null).order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error('문의를 불러오지 못했습니다.');
    const ids: string[] = (parents ?? []).map((c: any) => c.id), postIds: string[] = [...new Set<string>((parents ?? []).map((c: any) => c.post_id))];
    const [replies, posts] = await Promise.all([
      ids.length ? db.from('comments').select('id,parent_id,user_id,creator,body,created_at').in('parent_id', ids).order('created_at', { ascending: true }) : { data: [] },
      postIds.length ? db.from('posts').select('id,title,user_id,creator').in('id', postIds) : { data: [] },
    ]);
    const postMap = new Map<string, any>((posts.data ?? []).map((p: any) => [p.id, p]));
    const rows: QnaRow[] = (parents ?? []).map((c: any) => {
      const p = postMap.get(c.post_id), sellerId: string | null = p?.user_id ?? null;
      const reps: BoardReply[] = (replies.data ?? []).filter((r: any) => r.parent_id === c.id).map((r: any) => ({ id: r.id, body: r.body, creator: r.creator, created_at: r.created_at, by_seller: Boolean(sellerId && r.user_id === sellerId) }));
      return { id: c.id, post_id: c.post_id, post_title: p?.title ?? '(삭제된 상품)', seller_id: sellerId, seller_name: p?.creator ?? '—', author: c.creator, body: c.body, created_at: c.created_at, answered: reps.some(r => r.by_seller), canReply: Boolean(sellerId), replies: reps };
    });
    return data.pendingOnly ? rows.filter(r => !r.answered && r.canReply && r.seller_id !== undefined) : rows;
  });

export const adminListNotices = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NoticeRow[]> => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const { data: rows, error } = await db.from('seller_store_notices').select('id,user_id,title,body,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) throw new Error('공지를 불러오지 못했습니다.');
    const ids: string[] = [...new Set<string>((rows ?? []).map((r: any) => r.user_id))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await db.from('profiles').select('user_id,nickname').in('user_id', ids);
      (profs ?? []).forEach((p: any) => names.set(p.user_id, p.nickname));
      const { data: posts } = await db.from('posts').select('user_id,creator,store_id').in('user_id', ids).not('store_id', 'is', null);
      (posts ?? []).forEach((p: any) => { if (p.creator) names.set(p.user_id, p.creator); });
    }
    return (rows ?? []).map((r: any) => ({ id: r.id, seller_id: r.user_id, seller_name: names.get(r.user_id) ?? '셀러', title: r.title, body: r.body, created_at: r.created_at }));
  });

/** 관리자가 쓴 답변을 해당 상품 셀러의 이름(계정)으로 저장합니다. */
export const adminReplyAsSeller = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ commentId: z.string().uuid(), body: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const { data: c } = await db.from('comments').select('id,post_id,parent_id').eq('id', data.commentId).maybeSingle();
    if (!c) throw new Error('문의를 찾을 수 없습니다.');
    const { data: p } = await db.from('posts').select('id,user_id,creator').eq('id', c.post_id).maybeSingle();
    if (!p?.user_id) throw new Error('이 상품은 셀러 계정이 없어 답변할 수 없습니다.');
    const { data: prof } = await db.from('profiles').select('nickname').eq('user_id', p.user_id).maybeSingle();
    const creator = String(prof?.nickname?.trim() || p.creator || 'VELA 셀러').slice(0, 40);
    const { error } = await db.from('comments').insert({ post_id: c.post_id, user_id: p.user_id, creator, body: data.body, parent_id: c.parent_id ?? c.id });
    if (error) throw new Error('답변을 저장하지 못했습니다.');
    return { ok: true };
  });

/** 문의 글 또는 답변을 삭제합니다(문의를 지우면 그 아래 답변도 함께 지워집니다). */
export const adminDeleteComment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ commentId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const { error } = await db.from('comments').delete().eq('id', data.commentId);
    if (error) throw new Error('삭제하지 못했습니다.');
    return { ok: true };
  });

/** 셀러 공지를 삭제합니다. */
export const adminDeleteNotice = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ noticeId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const { error } = await db.from('seller_store_notices').delete().eq('id', data.noticeId);
    if (error) throw new Error('삭제하지 못했습니다.');
    return { ok: true };
  });
