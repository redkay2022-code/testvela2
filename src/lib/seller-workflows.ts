export type SalesOrder = { id: string; order_no: string; title: string; amount_usd: number; stage: string; created_at: string; updated_at: string; cancelled_at: string | null; refunded_amount_usd: number; dispute_open: boolean };
export type SalesPeriod = 'daily' | 'monthly' | 'yearly';
export function completedOrders(orders: SalesOrder[]) { return orders.filter(o => o.stage === 'delivered' && !o.cancelled_at); }
export function salesTrend(orders: SalesOrder[], period: SalesPeriod, date: string) {
  const anchor = new Date(`${date}T00:00:00Z`), count = period === 'daily' ? 30 : period === 'monthly' ? 12 : 5;
  const key = (d: Date) => d.toISOString().slice(0, period === 'daily' ? 10 : period === 'monthly' ? 7 : 4);
  const buckets = Array.from({ length: count }, (_, i) => {
    const d = new Date(anchor);
    if (period === 'daily') d.setUTCDate(d.getUTCDate() - count + i + 1);
    else if (period === 'monthly') { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - count + i + 1); }
    else { d.setUTCMonth(0, 1); d.setUTCFullYear(d.getUTCFullYear() - count + i + 1); }
    return { date: key(d), label: period === 'daily' ? key(d).slice(5) : key(d), total: 0, orders: 0 };
  });
  for (const order of completedOrders(orders)) {
    const bucket = buckets.find(b => b.date === key(new Date(order.updated_at)));
    if (bucket) { bucket.total += Math.max(0, Number(order.amount_usd) - Number(order.refunded_amount_usd)); bucket.orders++; }
  }
  return buckets;
}
export function escrowTotals(payments: { amount_usd: number; escrow_status: string }[]) {
  return payments.reduce((s, p) => ({ released: s.released + (p.escrow_status === 'RELEASED' ? Number(p.amount_usd) : 0), pending: s.pending + (p.escrow_status === 'HELD' ? Number(p.amount_usd) : 0) }), { released: 0, pending: 0 });
}
export const publicationUpdate = (active: boolean) => ({ status: active ? 'published' : 'draft', product_status: active ? 'PUBLISHED' : 'DRAFT' });