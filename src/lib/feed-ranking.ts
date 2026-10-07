import type { LuxuryPost } from './luxury-market';
import { sellerIdentity } from './seller-directory';
import { ratingAverage } from './reputation';

/** Seller trust score: reputation rating dominates, then completed sales, then review count. */
export function trustScore(post: LuxuryPost, reviewCount: number): number {
  const rating = ratingAverage(post.reputation) ?? 0;
  const sales = Math.max(0, post.reputation.completedSales);
  return rating * 100 + Math.min(sales, 200) * 0.1 + Math.min(reviewCount, 50) * 0.2;
}

/** Orders posts by seller trust + review activity, keeping input order on ties. */
export function rankRecommended(posts: LuxuryPost[], reviewCounts: Record<string, number>): LuxuryPost[] {
  return posts
    .map((post, index) => ({ post, index, score: trustScore(post, reviewCounts[sellerIdentity(post)] ?? 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.post);
}
