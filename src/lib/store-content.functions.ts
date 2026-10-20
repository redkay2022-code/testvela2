import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { storeIntroductionSchema } from './store-content';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const saveStoreContent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('introduction'), introduction: storeIntroductionSchema }),
    z.object({ kind: z.literal('notice'), id: z.string().uuid().optional(), title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(5000) }),
    z.object({ kind: z.literal('delete'), id: z.string().uuid() }),
  ]).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await supabase.rpc('has_role', { _user_id: userId, _role: 'seller' });
    if (role.error || !role.data) throw new Error('셀러 본인만 작성할 수 있습니다.');
    if (data.kind === 'introduction') {
      const result = await supabase.from('seller_store_content').upsert({ user_id: userId, introduction: data.introduction, updated_at: new Date().toISOString() }).select('user_id').single();
      if (result.error) throw new Error('저장하지 못했습니다.');
    } else if (data.kind === 'delete') {
      const result = await supabase.from('seller_store_notices').delete().eq('id', data.id).eq('user_id', userId).select('id').single();
      if (result.error) throw new Error('삭제하지 못했습니다.');
    } else {
      const row = { title: data.title, body: data.body, updated_at: new Date().toISOString() };
      const result = data.id
        ? await supabase.from('seller_store_notices').update(row).eq('id', data.id).eq('user_id', userId).select('id').single()
        : await supabase.from('seller_store_notices').insert({ ...row, user_id: userId }).select('id').single();
      if (result.error) throw new Error('저장하지 못했습니다.');
    }
    return { ok: true };
  });
/** 최고관리자가 셀러의 '스토어 소개'를 작성·수정·삭제(빈 글 저장 = 삭제)합니다. */
export const adminSaveStoreIntro = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sellerId: z.string().uuid(), introduction: storeIntroductionSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const mod = await import('./admin-auth.server');
    await mod.assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as any;
    const result = data.introduction === ''
      ? await db.from('seller_store_content').delete().eq('user_id', data.sellerId)
      : await db.from('seller_store_content').upsert({ user_id: data.sellerId, introduction: data.introduction, updated_at: new Date().toISOString() });
    if (result.error) throw new Error('저장하지 못했습니다.');
    return { ok: true };
  });
