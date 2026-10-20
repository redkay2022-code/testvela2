import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** 셀러 계정(관리자 겸임 제외)은 상품을 구매할 수 없다. DB 트리거도 같은 규칙으로 막는다. */
export async function isSellerBuyerBlocked(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  if (error || !data) return false;
  const roles = data.map(r => String(r.role));
  return roles.includes('seller') && !roles.includes('admin');
}

export function useSellerPurchaseBlock(userId: string | null | undefined): boolean {
  const q = useQuery({ queryKey: ['seller-purchase-block', userId ?? null], enabled: Boolean(userId), staleTime: 5 * 60_000, retry: 1, queryFn: () => isSellerBuyerBlocked(userId) });
  return Boolean(userId) && q.data === true;
}
