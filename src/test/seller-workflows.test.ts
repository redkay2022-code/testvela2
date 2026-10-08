import { describe, it, expect } from 'vitest';
import { salesTrend, escrowTotals, publicationUpdate, completedOrders, type SalesOrder } from '@/lib/seller-workflows';
const order = (patch: Partial<SalesOrder> = {}): SalesOrder => ({ id:'1', order_no:'1',title:'시계',amount_usd:100,stage:'delivered',created_at:'2026-09-01T00:00:00Z',updated_at:'2026-10-08T00:00:00Z',cancelled_at:null,refunded_amount_usd:0,dispute_open:false,...patch });
describe('seller workflows', () => {
 it('unchecking 판매 removes both published states', () => { expect(publicationUpdate(false)).toEqual({status:'draft',product_status:'DRAFT'}); });
 it('completed history excludes incomplete and cancelled orders', () => { expect(completedOrders([order(),order({stage:'shipped'}),order({cancelled_at:'2026-10-08'})])).toHaveLength(1); });
 for (const period of ['daily','monthly','yearly'] as const) it(`${period} chart totals real completed sales net of refunds`, () => { const buckets=salesTrend([order({refunded_amount_usd:20}),order({stage:'shipped'})],period,'2026-10-08'); expect(buckets.reduce((s,b)=>s+b.total,0)).toBe(80); });
 it('escrow counts released and held funds without pending/unverified payments', () => { expect(escrowTotals([{amount_usd:120,escrow_status:'RELEASED'},{amount_usd:60,escrow_status:'HELD'},{amount_usd:999,escrow_status:'PENDING'}])).toEqual({released:120,pending:60}); });
});