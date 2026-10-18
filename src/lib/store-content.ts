export function canEditStoreContent(viewerId: string | undefined, sellerId: string | undefined, roles: readonly string[]) {
  return Boolean(viewerId && sellerId && viewerId === sellerId && roles.includes('seller'));
}
export function isLogisticsOrder(order: { stage: string; cancelled_at?: string | null }) {
  return order.stage !== 'delivered' && !order.cancelled_at;
}