import type { SellerReputation, SellerTier } from './reputation';

export type TierOrderRow = { seller_id: string | null; amount_usd: number | string; stage: string; dispute_opened_at: string | null };
export type StudioMetrics = { volumeUsd: number; completedSales: number; totalOrders: number; disputes: number; disputeRate: number };

/** Pure: completed (delivered) escrow orders count toward volume; dispute rate covers all orders. */
export function metricsFromOrders(rows: TierOrderRow[]): StudioMetrics {
  const done = rows.filter(r => r.stage === 'delivered');
  const disputes = rows.filter(r => r.dispute_opened_at).length;
  return { volumeUsd: done.reduce((s, r) => s + Number(r.amount_usd || 0), 0), completedSales: done.length, totalOrders: rows.length, disputes, disputeRate: rows.length ? (disputes / rows.length) * 100 : 0 };
}
/** Live sellers have no trusted rating source yet, so rating stays null. */
export type RatingStats = { average: number | null; count: number; breakdown: [number, number, number, number, number] };
/** Pure: average = sum of order ratings / number of rated reviews; breakdown index 0 = 1 star. */
export function ratingStats(ratings: Array<number | null | undefined>): RatingStats {
  const valid = ratings.filter((r): r is number => typeof r === 'number' && r >= 1 && r <= 5);
  const breakdown: RatingStats['breakdown'] = [0, 0, 0, 0, 0];
  valid.forEach(r => { breakdown[Math.round(r) - 1]! += 1; });
  return { average: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null, count: valid.length, breakdown };
}
export function liveReputation(m: StudioMetrics, override: SellerTier | null, stats?: RatingStats): SellerReputation {
  return { approved: true, ratings: null, completedSales: m.completedSales, volumeUsd: m.volumeUsd, disputeRate: m.disputeRate, override, ratingAvg: stats?.average ?? null, ratingCount: stats?.count ?? 0 };
}
