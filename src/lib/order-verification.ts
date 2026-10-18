export type VerificationOrder = { payment_verified_at: string | null; stage: string; cancelled_at: string | null };
export function verificationStatus(order: Pick<VerificationOrder, 'payment_verified_at'>) {
  return order.payment_verified_at ? 'CONFIRMED' : 'PENDING_VERIFICATION';
}
export function isActiveTransaction(order: VerificationOrder) {
  return !order.cancelled_at && order.stage !== 'delivered';
}
export function canViewTransaction(role: 'admin' | 'seller' | 'buyer', uid: string, order: { buyer_id: string; seller_id: string | null }) {
  return role === 'admin' || (role === 'seller' ? order.seller_id === uid : order.buyer_id === uid);
}
export const sampleTransaction = {
  id: 'sample-VM-35FAFF34', order_no: 'VM-35FAFF34', post_id: 'sample-product-35FAFF34',
  title: '그린 다이얼 · 오이스터 브레이슬릿', buyer_id: 'sample-buyer-66', buyer_name: '구매자 66',
  seller_id: 'sample-valee-time', seller_name: 'Valee&Time', amount_usd: 5.5, network: 'USDT-TRC20',
  stage: 'placed', cancelled_at: null, payment_verified_at: null,
};