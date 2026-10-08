/** Pure VELA Point maths. The database triggers enforce the same rules; this mirrors them for display. */
export const DEFAULT_POINT_VALUE = 0.001;
export const DEFAULT_MAX_REDEMPTION_PCT = 20;
export const DEFAULT_EARN_RATES = { bronze: 0.01, silver: 0.015, gold: 0.02, platinum: 0.03 } as const;

export const pointsToUsd = (points: number, value = DEFAULT_POINT_VALUE) => Math.round(points * value * 100) / 100;
export const formatPoints = (points: number) => `${new Intl.NumberFormat('en-US').format(Math.floor(points))} P`;
export const formatPointsUsd = (points: number, value = DEFAULT_POINT_VALUE) =>
  `${formatPoints(points)} (${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(pointsToUsd(points, value))})`;

/** Points earned on the product amount only (insurance, shipping, taxes and fees excluded). */
export function earnPoints(productUsd: number, earnRate: number, value = DEFAULT_POINT_VALUE) {
  if (!(productUsd > 0) || !(earnRate > 0)) return 0;
  return Math.floor(Math.round(productUsd * earnRate * 1e6) / 1e6 / value);
}

/** Max points usable on an order: a percentage of the product subtotal, capped by the balance. */
export function maxRedeemPoints(productUsd: number, available: number, pct = DEFAULT_MAX_REDEMPTION_PCT, value = DEFAULT_POINT_VALUE) {
  const cap = Math.floor(Math.round(productUsd * pct / 100 * 1e6) / 1e6 / value);
  return Math.max(0, Math.min(cap, Math.floor(available)));
}

export function clampRedeem(requested: number, productUsd: number, available: number, pct = DEFAULT_MAX_REDEMPTION_PCT, value = DEFAULT_POINT_VALUE) {
  const n = Number.isFinite(requested) ? Math.floor(requested) : 0;
  return Math.max(0, Math.min(n, maxRedeemPoints(productUsd, available, pct, value)));
}

/** Cash due: order total minus point discount. Points never cover insurance, shipping or fees. */
export function cashPayment(totalUsd: number, points: number, value = DEFAULT_POINT_VALUE) {
  return Math.round((totalUsd - pointsToUsd(points, value)) * 100) / 100;
}

/** Earned points kept after a partial refund, proportional to the non-refunded product amount. */
export function pointsAfterRefund(basePoints: number, productUsd: number, refundedUsd: number) {
  if (productUsd <= 0) return 0;
  const ratio = Math.min(Math.max(refundedUsd / productUsd, 0), 1);
  return Math.floor(basePoints * (1 - ratio));
}

export function daysUntil(date: string | null | undefined, now = Date.now()) {
  if (!date) return null;
  return Math.max(0, Math.ceil((new Date(date).getTime() - now) / 86_400_000));
}
