import { describe, expect, it } from 'vitest';
import { customerTabs, latestSellerMessage, purchaseMilestones, toggleCollection } from '@/lib/customer-dashboard';
describe('customer dashboard rules', () => {
  it('shows only the latest seller message for the purchased order', () => {
    const messages = [
      { order_id: 'VM-35FAFF34', author_role: 'seller', created_at: '2026-10-17', body: '준비 중입니다' },
      { order_id: 'VM-35FAFF34', author_role: 'seller', created_at: '2026-10-18', body: 'QC 사진을 보내겠습니다' },
      { order_id: 'other-order', author_role: 'seller', created_at: '2026-10-19', body: '다른 주문' },
      { order_id: 'VM-35FAFF34', author_role: 'buyer', created_at: '2026-10-20', body: '구매자 글' },
    ];
    expect(latestSellerMessage(messages, 'VM-35FAFF34')?.body).toBe('QC 사진을 보내겠습니다');
    expect(latestSellerMessage(messages, 'missing')).toBeUndefined();
  });
  it('defaults to saved, then orders, inquiries and likes', () => expect(customerTabs).toEqual(['saved', 'orders', 'qna', 'likes']));
  it('immediately saves once and removes on second selection', () => {
    expect(toggleCollection(['old'], 'new')).toEqual(['new', 'old']);
    expect(toggleCollection(['new', 'old'], 'new')).toEqual(['old']);
  });
  it('does not call uploaded QC approved until shipping preparation', () => {
    expect(purchaseMilestones({stage:'qc_done',payment_verified_at:'2026-10-09'})).toEqual([true,false,false,false]);
    expect(purchaseMilestones({stage:'shipping_prep',payment_verified_at:'2026-10-09'})).toEqual([true,true,false,false]);
  });
  it('keeps payment pending until verified and completes only delivered orders', () => {
    expect(purchaseMilestones({stage:'placed',payment_verified_at:null})).toEqual([false,false,false,false]);
    expect(purchaseMilestones({stage:'shipped',payment_verified_at:'2026-10-09'})).toEqual([true,true,true,false]);
    expect(purchaseMilestones({stage:'delivered',payment_verified_at:'2026-10-09'})).toEqual([true,true,true,true]);
  });
});