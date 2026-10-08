import type { LuxuryPost } from './luxury-market';
import { sellerIdentity } from './seller-directory';
import { ratingAverage } from './reputation';

/** Seller trust score: reputation rating dominates, then completed sales, then review count. */
export type PostRating = { average: number; count: number };
/** Seller rating dominates; then this listing's own buyer ratings (confidence-weighted), sales and review volume. */
export function trustScore(post: LuxuryPost, reviewCount: number, postRating?: PostRating): number {
  const rating = ratingAverage(post.reputation) ?? 0;
  const sales = Math.max(0, post.reputation.completedSales);
  const own = postRating && postRating.count > 0 ? postRating.average * 12 * Math.min(postRating.count, 10) / 10 : 0;
  return rating * 100 + own + Math.min(sales, 200) * 0.1 + Math.min(reviewCount, 50) * 0.2;
}

const FRESH_MS = 72 * 3600 * 1000;
/** Real uploads younger than 72h, so a seller sees a new post on Home immediately. */
export function freshUploadTime(post: LuxuryPost, now = Date.now()): number {
  if (post.sample || !post.source?.created_at) return 0;
  const t = Date.parse(post.source.created_at);
  return Number.isFinite(t) && now - t < FRESH_MS ? t : 0;
}

/** Fresh real uploads first (newest first), then seller trust + review activity, keeping input order on ties. */
export function rankRecommended(posts: LuxuryPost[], reviewCounts: Record<string, number>, now = Date.now(), postRatings: Record<string, PostRating> = {}): LuxuryPost[] {
  return posts
    .map((post, index) => ({ post, index, fresh: freshUploadTime(post, now), score: trustScore(post, reviewCounts[sellerIdentity(post)] ?? 0, postRatings[post.id]) }))
    .sort((a, b) => b.fresh - a.fresh || b.score - a.score || a.index - b.index)
    .map(entry => entry.post);
}
