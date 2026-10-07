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
export function liveReputation(m: StudioMetrics, override: SellerTier | null): SellerReputation {
  return { approved: true, ratings: null, completedSales: m.completedSales, volumeUsd: m.volumeUsd, disputeRate: m.disputeRate, override };
}
