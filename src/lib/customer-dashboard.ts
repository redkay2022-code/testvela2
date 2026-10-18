export const customerTabs = ['saved', 'orders', 'qna', 'likes'] as const;
export function latestSellerMessage<T extends { order_id: string; author_role: string; created_at: string }>(messages: T[], orderId: string): T | undefined {
  return messages.filter(message => message.order_id === orderId && message.author_role === 'seller').reduce<T | undefined>((latest, message) => !latest || message.created_at > latest.created_at ? message : latest, undefined);
}
export function purchaseMilestones(order: { stage: string; payment_verified_at: string | null }) {
  return [Boolean(order.payment_verified_at), ['shipping_prep', 'shipped', 'delivered'].includes(order.stage), ['shipped', 'delivered'].includes(order.stage), order.stage === 'delivered'];
}
export function toggleCollection(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(value => value !== id) : [id, ...ids];
}