import { describe, expect, it } from 'vitest';
import { customerTabs, purchaseMilestones, toggleCollection } from '@/lib/customer-dashboard';
describe('customer dashboard rules', () => {
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