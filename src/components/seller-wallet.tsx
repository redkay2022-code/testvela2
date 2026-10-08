import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { Link } from '@tanstack/react-router';
import { ShieldCheck, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/currency';
import { Button } from './ui/button';

export function SellerEscrowWallet({ user }: { user: User }) {
  const stats = useQuery({ queryKey: ['seller-escrow-wallet', user.id], queryFn: async () => {
    const { data, error } = await supabase.rpc('seller_dashboard_stats');
    if (error) throw error;
    return data as Record<string, number> | null;
  }, refetchInterval: 30_000 });
  return <div className="py-5"><Wallet className="mb-4 text-primary"/><h2 className="text-lg font-semibold">암호화폐 지갑 · 에스크로</h2><dl className="my-5 border-y border-border py-5"><dt className="text-sm text-muted-foreground">에스크로 입금 예정 금액</dt><dd className="mt-2 text-2xl font-semibold" data-no-translate>{stats.data ? formatMoney(Number(stats.data.escrow_pending_usd ?? 0), 'USD') : '—'}</dd></dl>{stats.isError && <p role="alert" className="mb-4 text-sm text-destructive">입금 예정 금액을 불러오지 못했습니다.</p>}<p className="mb-5 flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary"/>주문 에스크로의 USD 환산 금액이며, 출금 가능한 암호화폐 잔액이 아닙니다.</p><Button asChild variant="goldOutline"><Link to="/seller" search={{ role: 'seller', section: 'orders' }}>주문별 에스크로 확인</Link></Button></div>;
}