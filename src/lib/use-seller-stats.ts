import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TEST_COUNTS_ENABLED } from '@/lib/test-counts';

export type SellerStat = { followers: number; likes: number; saves: number };

/** Public totals per seller (followers, likes, saves). Counts only: no names or user ids leave the database. */
export function useSellerStats() {
  return useQuery({
    queryKey: ['seller-public-stats'], staleTime: 60_000, retry: 1,
    queryFn: async () => {
      const call = supabase.rpc as unknown as (fn: string) => Promise<{ data: { seller_key: string; followers: number; likes: number; saves: number }[] | null; error: { message: string } | null }>;
      const { data, error } = await call.call(supabase, 'seller_public_stats');
      if (error) throw new Error(error.message);
      return new Map((data ?? []).map(r => [r.seller_key, { followers: Number(r.followers), likes: Number(r.likes), saves: TEST_COUNTS_ENABLED ? Math.floor(Number(r.likes) / 3) : Number(r.saves) } satisfies SellerStat]));
    },
  });
}
export const compactCount = (n: number) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n);
