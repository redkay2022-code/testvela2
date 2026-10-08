import { describe, expect, it } from 'vitest';
import { sortFeed } from '@/lib/feed-filters';
import { photoTooLarge } from '@/lib/listing-media';
import type { LuxuryPost } from '@/lib/luxury-market';

const p = (id: string, price: number | null, created_at: string) => ({ id, price, source: { created_at } }) as unknown as LuxuryPost;
const posts = [p('a', 520, '2026-01-02'), p('b', null, '2026-01-03'), p('c', 1450, '2026-01-01')];

describe('feed sorting', () => {
  it('price high to low, unpriced last', () => expect(sortFeed(posts, 'price_desc').map(x => x.id)).toEqual(['c', 'a', 'b']));
  it('price low to high, unpriced last', () => expect(sortFeed(posts, 'price_asc').map(x => x.id)).toEqual(['a', 'c', 'b']));
  it('newest first', () => expect(sortFeed(posts, 'newest').map(x => x.id)).toEqual(['b', 'a', 'c']));
});

describe('upload limits', () => {
  it('photos over 10MB are rejected', () => {
    expect(photoTooLarge({ size: 10 * 1024 * 1024 })).toBe(false);
    expect(photoTooLarge({ size: 10 * 1024 * 1024 + 1 })).toBe(true);
  });
});

import { MAX_LISTING_PHOTOS as MAX_P } from '@/lib/listing-media';
describe('listing media limit', () => { it('allows 9 photos with 1 video', () => { expect(MAX_P).toBe(9); }); });
