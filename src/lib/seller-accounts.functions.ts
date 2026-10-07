import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Signed-in user's roles, WeChat verification and seller application. */
export const getMyAccount = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [roles, wechat, app] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('wechat_identities').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('seller_applications').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    return { roles: (roles.data ?? []).map(r => r.role), wechat: wechat.data, application: app.data };
  });

/**
 * Sample WeChat verification until WeChat Open Platform keys are configured.
 * Real sign-in will replace this with the OAuth result; rows stay flagged is_sample.
 */
export const verifyWechatSample = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ nickname: z.string().trim().min(1).max(40), phone: z.string().trim().regex(/^\+?[0-9 -]{6,20}$/) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const row = { user_id: context.userId, wechat_id: `wxid_sample_${context.userId.slice(0, 8)}`, nickname: data.nickname, phone: data.phone, avatar_url: null, is_sample: true, verified_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from('wechat_identities').upsert(row);
    if (error) throw new Error('Verification failed. Please try again.');
    return row;
  });

export const submitSellerApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ studio_name: z.string().trim().min(1).max(80), region: z.string().trim().min(1).max(80), bio: z.string().trim().max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: wx } = await context.supabase.from('wechat_identities').select('*').eq('user_id', context.userId).maybeSingle();
    if (!wx) throw new Error('Verify your WeChat identity first.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('seller_applications').upsert({ user_id: context.userId, ...data, wechat_id: wx.wechat_id, wechat_nickname: wx.nickname, wechat_avatar: wx.avatar_url, wechat_phone: wx.phone, status: 'pending', reviewed_at: null }, { onConflict: 'user_id' });
    if (error) throw new Error('Application could not be submitted.');
    return { ok: true };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (!data) throw new Error('Forbidden');
}

export const listSellerApplications = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from('seller_applications').select('*').order('created_at', { ascending: false });
    if (error) throw new Error('Could not load applications.');
    return data;
  });

export const decideSellerApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: app, error } = await supabaseAdmin.from('seller_applications').update({ status: data.approve ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() }).eq('id', data.id).select('user_id').single();
    if (error || !app) throw new Error('Could not update application.');
    if (data.approve) await supabaseAdmin.from('user_roles').upsert({ user_id: app.user_id, role: 'seller' }, { onConflict: 'user_id,role', ignoreDuplicates: true });
    else await supabaseAdmin.from('user_roles').delete().eq('user_id', app.user_id).eq('role', 'seller');
    return { ok: true };
  });
