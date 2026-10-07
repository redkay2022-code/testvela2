import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SellerTier } from './reputation';
import { liveReputation, metricsFromOrders } from './studio-metrics';
export * from './studio-metrics';

export function useStudioReputation(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['studio-tier', userId], enabled: !!userId, staleTime: 30_000,
    queryFn: async () => {
      const [orders, ov] = await Promise.all([
        supabase.from('orders').select('seller_id, amount_usd, stage, dispute_opened_at').eq('seller_id', userId!),
        supabase.from('seller_tier_overrides').select('tier').eq('seller_id', userId!).maybeSingle(),
      ]);
      return liveReputation(metricsFromOrders(orders.data ?? []), (ov.data?.tier as SellerTier | undefined) ?? null);
    },
  });
}
