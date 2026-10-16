import { describe, expect, it } from 'vitest';
import { personalFeed, type FeedSignals } from '@/lib/personal-feed';
import { sellerIdentity } from '@/lib/seller-directory';
import type { LuxuryPost } from '@/lib/luxury-market';

const now = Date.parse('2026-10-16T00:00:00Z');
const post = (id: string, seller: string, fresh = false) => ({ id, creator: seller, sample: false, category: 'watch', reputation: { completedSales: 0 }, source: { user_id: seller, store_id: null, created_at: new Date(now - (fresh ? 3600_000 : 30 * 86_400_000)).toISOString() } }) as unknown as LuxuryPost;
const sig: FeedSignals = { now, seed: 's', userId: null, likedIds: new Set(), savedIds: new Set(), followedSellers: new Set(), seen: {}, popularity: {} };

describe('personalFeed seller spreading', () => {
  it('never shows one seller back to back even when that seller has many brand-new uploads', () => {
    const posts = [...Array.from({ length: 12 }, (_, i) => post(`a${i}`, 'A', true)), ...Array.from({ length: 5 }, (_, i) => post(`b${i}`, 'B')), ...Array.from({ length: 5 }, (_, i) => post(`c${i}`, 'C'))];
    const out = personalFeed(posts, sig);
    expect(out).toHaveLength(22);
    for (let i = 1; i < 10; i++) expect(sellerIdentity(out[i]!)).not.toBe(sellerIdentity(out[i - 1]!));
  });
});
