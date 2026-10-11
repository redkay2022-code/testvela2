import { describe, expect, it } from 'vitest';
import { rankRecommended, trustScore } from '@/lib/feed-ranking';
import { studioReputation, unknownReputation } from '@/lib/reputation';
import type { LuxuryPost } from '@/lib/luxury-market';

const post = (id: string, reputation = unknownReputation, userId = 'owner'): LuxuryPost =>
  ({ id, title: id, creator: id, sample: false, reputation, source: { user_id: userId } }) as LuxuryPost;

describe('recommended feed ranking', () => {
  it('ranks higher-rated sellers first', () => {
    const ranked = rankRecommended([post('low'), post('high', studioReputation, 'studio')], {});
    expect(ranked.map(p => p.id)).toEqual(['high', 'low']);
  });
  it('uses review counts to break trust ties', () => {
    const a = post('a', studioReputation, 'studio-a');
    const b = post('b', studioReputation, 'studio-b');
    const ranked = rankRecommended([a, b], { 'studio-b': 5 });
    expect(ranked[0]?.id).toBe('b');
  });
  it('keeps input order on full ties and never mutates the input', () => {
    const input = [post('x'), post('y')];
    expect(rankRecommended(input, {}).map(p => p.id)).toEqual(['x', 'y']);
    expect(input.map(p => p.id)).toEqual(['x', 'y']);
  });
  it('scores rating above sales and reviews', () => {
    const strong = post('strong', { approved: true, ratings: [4.9, 4.9, 4.9, 4.9], completedSales: 60 }, 's1');
    const weak = post('weak', { approved: true, ratings: [4.5, 4.5, 4.5, 4.5], completedSales: 500 }, 's2');
    expect(trustScore(strong, 0)).toBeGreaterThan(trustScore(weak, 50));
  });
});
