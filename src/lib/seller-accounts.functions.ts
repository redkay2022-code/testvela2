import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Signed-in user's roles, anonymous profile and seller application. */
export const getMyAccount = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [roles, profile, app] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('profiles').select('system_code, nickname, avatar_url').eq('user_id', userId).maybeSingle(),
      supabase.from('seller_applications').select('id, status, nickname, system_code, created_at').eq('user_id', userId).maybeSingle(),
    ]);
    return { roles: (roles.data ?? []).map(r => r.role), profile: profile.data, application: app.data };
  });

export const updateNickname = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ nickname: z.string().trim().min(1).max(30) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('profiles').update({ nickname: data.nickname }).eq('user_id', context.userId);
    if (error) throw new Error('Nickname could not be saved.');
    return { ok: true };
  });

/** No personal info: the request carries only the account code and current nickname. */
export const submitSellerApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from('profiles').select('system_code, nickname').eq('user_id', context.userId).maybeSingle();
    if (!profile) throw new Error('Your account profile is missing.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('seller_applications').upsert({ user_id: context.userId, system_code: profile.system_code, nickname: profile.nickname, studio_name: profile.nickname, region: '', bio: '', wechat_id: '', wechat_nickname: '', wechat_avatar: null, wechat_phone: null, status: 'pending', reviewed_at: null }, { onConflict: 'user_id' });
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
    const { data, error } = await context.supabase.from('seller_applications').select('id, user_id, system_code, nickname, status, created_at').order('created_at', { ascending: false });
    if (error) throw new Error('Could not load applications.');
    const ids = data.map(a => a.user_id);
    const [orders, overrides] = ids.length ? await Promise.all([
      context.supabase.from('orders').select('seller_id, amount_usd, stage, dispute_opened_at').in('seller_id', ids),
      context.supabase.from('seller_tier_overrides').select('seller_id, tier').in('seller_id', ids),
    ]) : [{ data: [] }, { data: [] }];
    const { metricsFromOrders } = await import('./studio-metrics');
    return data.map(a => ({ ...a, metrics: metricsFromOrders((orders.data ?? []).filter(o => o.seller_id === a.user_id)), override: ((overrides.data ?? []).find(o => o.seller_id === a.user_id)?.tier ?? null) as 'standard' | 'pro' | 'prime' | 'master' | null }));
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

export const setSellerTierOverride = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ sellerId: z.string().uuid(), tier: z.enum(['standard', 'pro', 'prime', 'master']).nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const q = context.supabase.from('seller_tier_overrides');
    const { error } = data.tier ? await q.upsert({ seller_id: data.sellerId, tier: data.tier, updated_by: context.userId, updated_at: new Date().toISOString() }) : await q.delete().eq('seller_id', data.sellerId);
    if (error) throw new Error('Could not update tier.');
    return { ok: true };
  });
