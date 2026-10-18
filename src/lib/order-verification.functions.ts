import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { canViewTransaction, isActiveTransaction } from './order-verification';

export const confirmOrderPayment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('관리자만 입금을 확인할 수 있습니다.');
    const { data: order, error } = await context.supabase.from('orders').select('id,txid,payment_verified_at,cancelled_at').eq('id', data.orderId).single();
    if (error || !order) throw new Error('주문을 찾을 수 없습니다.');
    if (order.cancelled_at) throw new Error('취소된 주문입니다.');
    if (order.payment_verified_at) return { status: 'CONFIRMED' as const };
    if (!order.txid?.trim()) throw new Error('구매자가 TXID를 제출해야 확인할 수 있습니다.');
    const result = await context.supabase.from('orders').update({ payment_verified_at: new Date().toISOString() }).eq('id', order.id).is('payment_verified_at', null).select('payment_verified_at').single();
    if (result.error || !result.data?.payment_verified_at) throw new Error('입금 확인을 저장하지 못했습니다. 다시 확인해 주세요.');
    return { status: 'CONFIRMED' as const };
  });

export const getActiveTransactions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ role: z.enum(['admin', 'seller', 'buyer']) }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.role !== 'buyer') {
      const { data: roles, error } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
      if (error || !roles?.some(r => r.role === 'admin' || (data.role === 'seller' && r.role === 'seller'))) throw new Error('권한이 없습니다.');
    }
    let query = context.supabase.from('orders').select('id,order_no,post_id,title,buyer_id,seller_id,seller_name,amount_usd,network,stage,payment_verified_at,cancelled_at').is('cancelled_at', null).neq('stage', 'delivered').order('created_at', { ascending: false });
    if (data.role === 'buyer') query = query.eq('buyer_id', context.userId);
    if (data.role === 'seller') query = query.eq('seller_id', context.userId);
    const { data: rows, error } = await query;
    if (error) throw new Error('진행 중인 거래를 불러오지 못했습니다.');
    const orders = (rows ?? []).filter(o => isActiveTransaction(o) && canViewTransaction(data.role, context.userId, o));
    const ids = orders.map(o => o.id);
    const labels = ids.length ? await context.supabase.rpc('order_party_labels', { _order_ids: ids }) : { data: [], error: null };
    if (labels.error) throw new Error('거래 참여자 정보를 불러오지 못했습니다.');
    return orders.map(o => {
      const buyer = labels.data?.find(p => p.user_id === o.buyer_id), seller = labels.data?.find(p => p.user_id === o.seller_id);
      return { ...o, buyer_name: buyer?.nickname || '구매자', buyer_code: buyer?.system_code ?? o.buyer_id, seller_name: seller?.nickname || o.seller_name, seller_code: seller?.system_code ?? o.seller_id };
    });
  });