import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MessageSquare, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { latestSellerMessage } from '@/lib/customer-dashboard';
import { sellerIdentity } from '@/lib/seller-directory';
import type { LuxuryPost } from '@/lib/luxury-market';
import { Button } from './ui/button';
import { Tx } from './tx';
import { TranslatableText } from './translatable-text';

export function PurchaseSellerMessages({ order, userId, product }: { order: { id: string; seller_id: string | null; seller_name: string }; userId: string; product?: LuxuryPost }) {
  const messages = useQuery({
    queryKey: ['buyer-order-messages', userId, order.id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase.from('order_messages').select('id,order_id,author_role,body,created_at').eq('order_id', order.id).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });
  const latest = latestSellerMessage(messages.data ?? [], order.id);
  const seller = product ? sellerIdentity(product) : order.seller_id;
  return <section className="mt-4 border-t border-border pt-3 notranslate" translate="no">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="min-w-0 break-words"><Tx>판매자</Tx> · <strong data-i18n-skip>{order.seller_name}</strong></p>
      {seller && <Button asChild size="sm" variant="ghost"><Link to="/store" search={{ seller, storeTab: 'products' }}><Store size={14}/><Tx>판매자 스토어</Tx></Link></Button>}
    </div>
    {latest && <div className="my-3 border-l-2 border-primary pl-3"><p className="text-xs text-primary"><Tx>메시지</Tx></p><TranslatableText as="p" text={latest.body} className="mt-1 text-sm whitespace-pre-wrap break-words"/><time className="text-xs text-muted-foreground">{new Date(latest.created_at).toLocaleString()}</time></div>}
    {messages.isError && <div role="alert" className="text-sm text-destructive"><Tx>주문 정보를 불러오지 못했습니다.</Tx><Button variant="ghost" size="sm" onClick={() => void messages.refetch()}><Tx>다시 시도</Tx></Button></div>}
    <Button asChild variant="goldOutline" className="mt-2 w-full"><Link to="/me" search={previous => ({ ...previous, customerTab: 'orders', panel: 'orders', orderId: order.id, orderView: 'messages' })} resetScroll={false}><MessageSquare size={16}/><Tx>판매자에게 메시지</Tx>{messages.data?.length ? ` (${messages.data.length})` : ''}</Link></Button>
  </section>;
}