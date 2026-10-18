import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Package, MessageCircle, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { dollars } from '@/lib/luxury-market';
import { stageLabel, type EscrowStage } from '@/lib/escrow';
import { useCurrency } from './currency';
import { Button } from './ui/button';
import { Tx } from './tx';
import { ListPagination, usePagination } from './list-pagination';

export function SellerOrderHistory({ userId }: { userId: string }) {
  const { lang } = useCurrency();
  const q = useQuery({ queryKey: ['seller-order-history', userId], refetchInterval: 5000, queryFn: async () => {
    const result = await supabase.from('orders').select('id,order_no,title,amount_usd,stage,created_at,payment_verified_at,cancelled_at,buyer_id').eq('seller_id', userId).order('created_at', { ascending: false });
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    const labels = rows.length ? await supabase.rpc('order_party_labels', { _order_ids: rows.map(r => r.id) }) : { data: [], error: null };
    if (labels.error) throw labels.error;
    return rows.map(r => ({ ...r, buyer: labels.data?.find(p => p.user_id === r.buyer_id)?.nickname ?? r.buyer_id.slice(0, 8) }));
  } });
  const pager = usePagination(q.data ?? []);
  return <section className="seller-section notranslate" translate="no" data-no-translate><h2><Tx>주문 내역</Tx></h2>{q.isLoading && <p><Tx>불러오는 중…</Tx></p>}{q.isError && <p role="alert"><Tx>주문 정보를 불러오지 못했습니다.</Tx></p>}{!q.isLoading && !q.data?.length && <p className="seller-empty"><Tx>받은 실제 주문이 여기에 표시됩니다.</Tx></p>}{pager.items.map(o => <article className="border-b border-border py-5" key={o.id}><div className="flex items-start gap-3"><Package className="shrink-0 text-primary" size={20}/><div className="min-w-0 flex-1"><small data-i18n-skip>{o.order_no} · {new Date(o.created_at).toLocaleDateString(lang)}</small><h3 className="break-words font-semibold" data-i18n-skip>{o.title}</h3><p className="text-sm text-muted-foreground"><Tx>구매자</Tx> · <span data-i18n-skip>{o.buyer}</span></p><p className="mt-2 text-xs text-primary"><Tx>{o.cancelled_at ? '취소된 주문' : !o.payment_verified_at ? '입금 확인 대기' : stageLabel(o.stage as EscrowStage)}</Tx></p></div><strong className="shrink-0 text-sm">{dollars(o.amount_usd)}</strong></div><div className="mt-3 flex flex-wrap gap-2">{!o.cancelled_at && <Button asChild variant="goldOutline" size="sm"><Link to="/seller-store" search={{ sellerView: 'shipping', orderId: o.id }}><Truck size={14}/><Tx>물류/배송</Tx></Link></Button>}<Button asChild variant="ghost" size="sm"><Link to="/seller-messages" search={{ conversation: o.id }}><MessageCircle size={14}/><Tx>메시지</Tx></Link></Button></div></article>)}<ListPagination pager={pager}/></section>;
}