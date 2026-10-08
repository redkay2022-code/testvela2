import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SellerTier } from './reputation';
import type { LuxuryPost } from './luxury-market';
import { sellerIdentity, sellerKey } from './seller-directory';
import { liveReputation, metricsFromOrders, ratingStats, type RatingStats } from './studio-metrics';
export * from './studio-metrics';

export type RecentReview = { id: string; nickname: string; rating: number | null; body: string; created_at: string };
export function useStudioReputation(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['studio-tier', userId], enabled: !!userId, staleTime: 30_000,
    queryFn: async () => {
      const [orders, ov, reviews] = await Promise.all([
        supabase.from('orders').select('seller_id, amount_usd, stage, dispute_opened_at').eq('seller_id', userId!),
        supabase.from('seller_tier_overrides').select('tier').eq('seller_id', userId!).maybeSingle(),
        supabase.from('reviews').select('id, nickname, rating, body, created_at').eq('seller_id', userId!).order('created_at', { ascending: false }),
      ]);
      const rows = reviews.data ?? [];
      const stats = ratingStats(rows.map(r => r.rating));
      return { reputation: liveReputation(metricsFromOrders(orders.data ?? []), (ov.data?.tier as SellerTier | undefined) ?? null, stats), stats, recent: rows.slice(0, 5) as RecentReview[] };
    },
  });
}
/** Public rating + override lookup keyed by normalized seller identity. */
export function useSellerRatingMap() {
  return useQuery({
    queryKey: ['seller-rating-map'], staleTime: 30_000,
    queryFn: async () => {
      const [reviews, ov] = await Promise.all([
        supabase.from('reviews').select('seller_id, rating').not('rating', 'is', null),
        supabase.from('seller_tier_overrides').select('seller_id, tier'),
      ]);
      const grouped = new Map<string, number[]>();
      (reviews.data ?? []).forEach(r => { const k = sellerKey(r.seller_id); grouped.set(k, [...(grouped.get(k) ?? []), r.rating as number]); });
      const stats: Record<string, RatingStats> = {}; grouped.forEach((v, k) => { stats[k] = ratingStats(v); });
      const overrides: Record<string, SellerTier> = {}; (ov.data ?? []).forEach(o => { overrides[sellerKey(o.seller_id)] = o.tier as SellerTier; });
      return { stats, overrides };
    },
  });
}
/** Live (non-sample) listings come from seller-role accounts, so they get a tier from public rating data. */
export function withLiveRatings(posts: LuxuryPost[], map: { stats: Record<string, RatingStats>; overrides: Record<string, SellerTier> } | undefined): LuxuryPost[] {
  if (!map) return posts;
  return posts.map(p => {
    const k = sellerKey(sellerIdentity(p)), st = map.stats[k];
    if (p.sample) return st ? { ...p, reputation: { ...p.reputation, ratingAvg: st.average, ratingCount: st.count } } : p;
    return { ...p, reputation: { approved: true, ratings: null, completedSales: 0, ratingAvg: st?.average ?? null, ratingCount: st?.count ?? 0, override: map.overrides[k] ?? null } };
  });
}

/** Buyer star ratings per listing (post_id is set server-side from the reviewed order). */
export function usePostRatings() {
  return useQuery({
    queryKey: ['post-ratings'], staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from('reviews').select('post_id, rating').not('rating', 'is', null).not('post_id', 'is', null);
      const out: Record<string, { average: number; count: number }> = {};
      (data ?? []).forEach(r => { const k = r.post_id as string, o = out[k] ?? { average: 0, count: 0 }; o.average = (o.average * o.count + (r.rating as number)) / (o.count + 1); o.count += 1; out[k] = o; });
      return out;
    },
  });
}
