export const customerTabs = ['saved', 'orders', 'qna', 'likes'] as const;
export function purchaseMilestones(order: { stage: string; payment_verified_at: string | null }) {
  return [Boolean(order.payment_verified_at), ['shipping_prep', 'shipped', 'delivered'].includes(order.stage), ['shipped', 'delivered'].includes(order.stage), order.stage === 'delivered'];
}
export function toggleCollection(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(value => value !== id) : [id, ...ids];
}