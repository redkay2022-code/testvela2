import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { INSTANT_PLANS, PRO_PROMO_MONTHS, planChangeSchema, sellerApplicationSchema } from './seller-plans';

/** Signed-in user's roles, anonymous profile and seller application. */
export const getMyAccount = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [roles, profile, app, planRow] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('profiles').select('system_code, nickname, avatar_url').eq('user_id', userId).maybeSingle(),
      supabase.from('seller_applications').select('id, status, nickname, system_code, created_at').eq('user_id', userId).maybeSingle(),
      /* separate query: if the plan columns are not in the database yet, the account still loads without them */
      supabase.from('seller_applications').select('plan, requested_plan').eq('user_id', userId).maybeSingle(),
    ]);
    return { roles: (roles.data ?? []).map(r => r.role), profile: profile.data, application: app.data ? { ...app.data, plan: planRow.data?.plan ?? null, requested_plan: planRow.data?.requested_plan ?? null } : app.data };
  });

export const updateNickname = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ nickname: z.string().trim().min(1).max(30) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('profiles').update({ nickname: data.nickname }).eq('user_id', context.userId);
    if (error) throw new Error('Nickname could not be saved.');
    await syncPostCreator(context.userId, data.nickname);
    return { ok: true };
  });

/** Posts keep a copy of the seller's display name; keep that copy in step with the profile nickname. */
async function syncPostCreator(userId: string, nickname: string) {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.from('posts').update({ creator: nickname.slice(0, 40) }).eq('user_id', userId).is('store_id', null);
  } catch { /* the nickname itself is already saved; the next sync repairs the posts */ }
}

/** Repairs posts written before the nickname was changed (runs when a seller opens their listings). */
export const syncMyPostNickname = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from('profiles').select('nickname').eq('user_id', context.userId).maybeSingle();
    if (profile?.nickname) await syncPostCreator(context.userId, profile.nickname);
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

/** Application form + chosen plan. Every answer is stored on the seller_applications row for the admin review. */
export const submitSellerApplicationForm = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => sellerApplicationSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: profile } = await context.supabase.from('profiles').select('system_code, nickname').eq('user_id', context.userId).maybeSingle();
    if (!profile) throw new Error('Your account profile is missing.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: existing } = await supabaseAdmin.from('seller_applications').select('status').eq('user_id', context.userId).maybeSingle();
    if (existing?.status === 'approved') throw new Error('Your seller account is already approved.');
    const { error } = await supabaseAdmin.from('seller_applications').upsert({
      user_id: context.userId, system_code: profile.system_code, nickname: profile.nickname, studio_name: profile.nickname,
      region: data.country, bio: '', wechat_id: '', wechat_nickname: '', wechat_avatar: null, wechat_phone: null,
      country: data.country, main_categories: data.mainCategories, main_sales_items: data.mainSalesItems, avg_price_range: data.avgPriceRange,
      sales_channels: data.salesChannels, business_role: data.businessRole, has_contracted_courier: data.hasCourier, plan: data.plan,
      requested_plan: null, plan_changed_at: new Date().toISOString(), promo_ends_at: data.plan === 'pro' ? addMonths(PRO_PROMO_MONTHS) : null,
      status: 'pending', reviewed_at: null,
    }, { onConflict: 'user_id' });
    if (error) { console.error('submitSellerApplicationForm', error.code, error.message); return { ok: false as const, code: error.code ?? 'db', detail: error.message.slice(0, 200) }; }
    return { ok: true as const };
  });

const addMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString(); };

/** An approved seller switches plan later. Basic / Pro apply immediately (no payment: Pro is $0 during the launch offer); Enterprise is requested and approved by the team. */
export const changeSellerPlan = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => planChangeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: app, error: readError } = await supabaseAdmin.from('seller_applications').select('status, plan, promo_ends_at').eq('user_id', context.userId).maybeSingle();
    if (readError) { console.error('changeSellerPlan', readError.code, readError.message); return { ok: false as const, code: readError.code ?? 'db', detail: readError.message.slice(0, 200) }; }
    if (!app || app.status !== 'approved') throw new Error('Only approved sellers can change plan.');
    if (app.plan === data.plan) throw new Error('You are already on this plan.');
    const now = new Date().toISOString();
    const patch = INSTANT_PLANS.includes(data.plan)
      ? { plan: data.plan, requested_plan: null, plan_changed_at: now, ...(data.plan === 'pro' && !app.promo_ends_at ? { promo_ends_at: addMonths(PRO_PROMO_MONTHS) } : {}) }
      : { requested_plan: data.plan };
    const { error } = await supabaseAdmin.from('seller_applications').update(patch).eq('user_id', context.userId);
    if (error) { console.error('changeSellerPlan', error.code, error.message); return { ok: false as const, code: error.code ?? 'db', detail: error.message.slice(0, 200) }; }
    return { ok: true as const, requested: !INSTANT_PLANS.includes(data.plan) };
  });

/** Admin: approve / decline a seller's Enterprise plan request. */
export const decidePlanChange = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: app } = await supabaseAdmin.from('seller_applications').select('requested_plan').eq('id', data.id).maybeSingle();
    if (!app?.requested_plan) throw new Error('No plan request.');
    const patch = data.approve ? { plan: app.requested_plan, requested_plan: null, plan_changed_at: new Date().toISOString() } : { requested_plan: null };
    const { error } = await supabaseAdmin.from('seller_applications').update(patch).eq('id', data.id);
    if (error) throw new Error('Could not update the plan.');
    return { ok: true };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (!data) throw new Error('Forbidden');
}

async function checkAdminPassword(supabase: any, userId: string, password: string) {
  const mod = await import('./admin-auth.server');
  await mod.checkAdminPassword(supabase, userId, password);
}

export const verifyAdminPassword = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ password: z.string().min(1).max(72) }).parse(d))
  .handler(async ({ context, data }) => { await checkAdminPassword(context.supabase, context.userId, data.password); return { ok: true }; });

export const listSellerApplications = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from('seller_applications').select('id, user_id, system_code, nickname, status, created_at, country, main_categories, main_sales_items, avg_price_range, sales_channels, business_role, has_contracted_courier, plan, requested_plan').order('created_at', { ascending: false });
    if (error) throw new Error('Could not load applications.');
    const ids = data.map(a => a.user_id);
    const [orders, overrides, reviews] = ids.length ? await Promise.all([
      context.supabase.from('orders').select('seller_id, amount_usd, stage, dispute_opened_at').in('seller_id', ids),
      context.supabase.from('seller_tier_overrides').select('seller_id, tier').in('seller_id', ids),
      context.supabase.from('reviews').select('seller_id, rating').in('seller_id', ids).not('rating', 'is', null),
    ]) : [{ data: [] }, { data: [] }, { data: [] }];
    const { metricsFromOrders, ratingStats } = await import('./studio-metrics');
    return data.map(a => ({ ...a, metrics: metricsFromOrders((orders.data ?? []).filter(o => o.seller_id === a.user_id)), rating: ratingStats((reviews.data ?? []).filter(r => r.seller_id === a.user_id).map(r => r.rating)), override: ((overrides.data ?? []).find(o => o.seller_id === a.user_id)?.tier ?? null) as 'standard' | 'pro' | 'prime' | 'master' | null }));
  });

export const decideSellerApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ id: z.string().uuid(), approve: z.boolean(), password: z.string().max(72).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    /* Revoking a seller is destructive: the admin must re-enter their password. */
    if (!data.approve) await checkAdminPassword(context.supabase, context.userId, data.password ?? '');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: app, error } = await supabaseAdmin.from('seller_applications').update({ status: data.approve ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() }).eq('id', data.id).select('user_id').single();
    if (error || !app) throw new Error('Could not update application.');
    if (data.approve) {
      await supabaseAdmin.from('user_roles').upsert({ user_id: app.user_id, role: 'seller' }, { onConflict: 'user_id,role', ignoreDuplicates: true });
      const w = await import('./seller-welcome');
      const { count } = await supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', app.user_id).eq('kind', w.SELLER_WELCOME_KIND);
      if (!count) await supabaseAdmin.from('notifications').insert({ user_id: app.user_id, kind: w.SELLER_WELCOME_KIND, title: w.SELLER_WELCOME_TITLE, body: w.sellerWelcomeBody('ko'), cta_label: w.sellerWelcomeCopy.ko.cta, cta_url: w.SELLER_WELCOME_CTA_URL });
    }
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
