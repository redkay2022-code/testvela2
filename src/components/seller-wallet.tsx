import { tx } from '@/lib/dom-translate';
import { useCurrency } from './currency';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { Link } from '@tanstack/react-router';
import { ShieldCheck, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/currency';
import { Button } from './ui/button';

export function SellerEscrowWallet({ user }: { user: User }) {
  const { lang } = useCurrency();
  const stats = useQuery({ queryKey: ['seller-escrow-wallet', user.id], queryFn: async () => {
    const { data, error } = await supabase.rpc('seller_dashboard_stats');
    if (error) throw error;
    return data as Record<string, number> | null;
  }, refetchInterval: 30_000 });
  return <div className="py-5"><Wallet className="mb-4 text-primary"/><h2 className="text-lg font-semibold"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("암호화폐 지갑 · 에스크로")}</span></h2><dl className="my-5 border-y border-border py-5"><dt className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("에스크로 입금 예정 금액")}</span></dt><dd className="mt-2 text-2xl font-semibold" data-no-translate>{typeof stats.data?.['escrow_pending_usd'] === 'number' ? formatMoney(stats.data['escrow_pending_usd'], 'USD') : '—'}</dd></dl>{stats.isError && <p role="alert" className="mb-4 text-sm text-destructive"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("입금 예정 금액을 불러오지 못했습니다.")}</span></p>}<p className="mb-5 flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary"/><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("주문 에스크로의 USD 환산 금액이며, 출금 가능한 암호화폐 잔액이 아닙니다.")}</span></p><Button asChild variant="goldOutline"><Link to="/seller" search={{ role: 'seller', section: 'orders' }}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("주문별 에스크로 확인")}</span></Link></Button></div>;
}