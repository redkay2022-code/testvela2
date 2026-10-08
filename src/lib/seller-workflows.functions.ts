import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { escrowTotals } from './seller-workflows';

export const getSellerWorkflows = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const { data: roles, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  if (roleError || !roles?.some(r => r.role === 'seller' || r.role === 'admin')) throw new Error('승인된 셀러만 이용할 수 있습니다.');
  const [activity, orders, replacements] = await Promise.all([
    supabase.rpc('seller_activity_summary'),
    supabase.from('orders').select('id,order_no,title,amount_usd,stage,created_at,updated_at,cancelled_at,refunded_amount_usd,dispute_open').eq('seller_id', userId).order('created_at', { ascending: false }),
    supabase.from('order_replacements').select('*').eq('seller_id', userId),
  ]);
  if (activity.error || orders.error || replacements.error) throw new Error('셀러 정보를 불러오지 못했습니다.');
  const ids = (orders.data ?? []).map(o => o.id);
  const [payments, messages] = ids.length ? await Promise.all([
    supabase.from('payment_transactions').select('amount_usd,escrow_status').in('order_id', ids),
    supabase.from('order_messages').select('id,order_id,author_role,body,created_at').in('order_id', ids).order('created_at', { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (payments.error || messages.error) throw new Error('대화·입금 정보를 불러오지 못했습니다.');
  return { activity: activity.data, orders: orders.data ?? [], messages: messages.data ?? [], replacements: replacements.data ?? [], escrow: escrowTotals(payments.data ?? []) };
});

export const saveReplacement = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), reason: z.string().trim().min(2).max(500), courier: z.string().trim().min(2).max(50).optional(), tracking: z.string().trim().regex(/^[A-Za-z0-9-]{6,40}$/).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: seller } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'seller' });
    const { data: admin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (!seller && !admin) throw new Error('권한이 없습니다.');
    const { data: order } = await context.supabase.from('orders').select('id,seller_id,dispute_open').eq('id', data.orderId).maybeSingle();
    if (!order || order.seller_id !== context.userId || !order.dispute_open) throw new Error('본인의 불량 신고 주문만 처리할 수 있습니다.');
    if (data.tracking) {
      if (!data.courier) throw new Error('택배사를 입력해 주세요.');
      const { data: media, error } = await context.supabase.from('order_qc_media').select('kind,round').eq('order_id', order.id);
      if (error) throw new Error('교환 QC 자료를 확인하지 못했습니다.');
      const round = Math.max(0, ...(media ?? []).map(m => m.round));
      const latest = (media ?? []).filter(m => m.round === round);
      if (round < 2 || latest.filter(m => m.kind === 'image').length < 9 || latest.filter(m => m.kind === 'video').length < 1) throw new Error('교환품 QC 사진 9장과 영상 1개를 먼저 업로드해 주세요.');
    }
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('order_replacements').upsert({ order_id: order.id, seller_id: context.userId, reason: data.reason, status: data.tracking ? 'shipped' : 'preparing', courier: data.courier ?? null, tracking_number: data.tracking ?? null, shipped_at: data.tracking ? new Date().toISOString() : null }, { onConflict: 'order_id' });
    if (error) throw new Error('교환 처리를 저장하지 못했습니다.');
    return { ok: true };
  });