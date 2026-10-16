import type { LuxuryPost } from './luxury-market';
import { freshUploadTime } from './feed-ranking';
import { sellerIdentity, sellerKey } from './seller-directory';
import type { SeenMap } from './seen-history';

/**
 * Home feed ordering for each visitor. Input is the existing "recommended" order (fresh uploads, seller trust);
 * this step only re-orders it:
 *   1. score = base position + freshness + popularity + followed seller + taste + (already seen: lower) + a little per-session randomness
 *   2. then spread sellers apart: the next card comes from a different seller than the previous two whenever one of
 *      similar quality is available, so one seller's many uploads never fill a whole screen (a hard rule, even when that seller's cards score far higher).
 * Every knob is in WEIGHTS below. Nothing is hidden; products are only moved.
 */
export const WEIGHTS = {
  base: 0.35,       // keep the existing recommended order as the backbone
  fresh: 0.30,      // uploads younger than 72 h, fading out
  coldStart: 0.15,  // extra push for fresh uploads that few people have seen yet
  popular: 0.15,    // views (14 days) and likes
  follow: 0.30,     // seller the visitor follows
  taste: 0.25,      // same category / factory / brand as products they liked, saved or lingered on
  seen: 0.45,       // already opened in the last 24 h (half that within 7 days)
  jitter: 0.22,     // per-session shuffle so everyone does not see an identical order
  ownFresh: 0.60,   // a seller's own new upload stays near the top of their Home
  spreadWindow: 400, // spreading looks this far down the list for a different seller (hard rule: no seller twice within 2 cards)
} as const;

export type Popularity = Record<string, { views: number; likes: number }>;
export type FeedSignals = {
  now: number;
  seed: string;
  userId: string | null;
  likedIds: ReadonlySet<string>;
  savedIds: ReadonlySet<string>;
  followedSellers: ReadonlySet<string>; // normalized with sellerKey()
  seen: SeenMap;
  popularity: Popularity;
};

const DAY = 86_400_000;

/** Small deterministic random number in [0,1) for (seed, id): same session = same order, new session = reshuffled. */
export function seededRandom(seed: string, id: string): number {
  let h = 1779033703 ^ (seed.length + id.length);
  const s = `${seed}|${id}`;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const attrOf = (post: LuxuryPost): string[] => {
  const specs = post.source?.specs && typeof post.source.specs === 'object' && !Array.isArray(post.source.specs) ? post.source.specs as Record<string, unknown> : {};
  const brand = (post.source?.brand || (typeof specs['brand'] === 'string' ? specs['brand'] : '') || '').toString().trim().toLowerCase();
  return [
    post.category ? `cat:${post.category}` : '', post.factory ? `fac:${post.factory}` : '',
    post.menuCategory ? `menu:${post.menuCategory}` : '', brand ? `brand:${brand}` : '',
  ].filter(Boolean);
};

/** How much this visitor has shown interest in each attribute: likes/saves count most, repeat opens and long stays add more. */
export function tasteProfile(posts: readonly LuxuryPost[], s: Pick<FeedSignals, 'likedIds' | 'savedIds' | 'seen'>): Map<string, number> {
  const tally = new Map<string, number>();
  for (const p of posts) {
    const seen = s.seen[p.id];
    let w = 0;
    if (s.likedIds.has(p.id)) w += 3;
    if (s.savedIds.has(p.id)) w += 3;
    if (seen) { w += Math.min(seen.n, 3) * 0.5; if (seen.ms >= 15_000) w += 1; if (seen.ms >= 45_000) w += 1; }
    if (w <= 0) continue;
    for (const a of attrOf(p)) tally.set(a, (tally.get(a) ?? 0) + w);
  }
  return tally;
}

export type ScoreParts = { id: string; score: number };

export function scorePosts(posts: readonly LuxuryPost[], s: FeedSignals): ScoreParts[] {
  const n = posts.length;
  const taste = tasteProfile(posts, s);
  const maxTaste = Math.max(0, ...taste.values());
  const pops = posts.map(p => { const v = s.popularity[p.id]; return v ? Math.log1p(v.views) + 2 * Math.log1p(v.likes) : 0; });
  const maxPop = Math.max(0, ...pops);
  return posts.map((p, i) => {
    const base = n > 1 ? 1 - i / (n - 1) : 1;
    const freshAt = freshUploadTime(p, s.now);
    const freshness = freshAt ? Math.max(0, 1 - (s.now - freshAt) / (3 * DAY)) : 0;
    const views = s.popularity[p.id]?.views ?? 0;
    const cold = freshAt && views < 20 ? freshness : 0;
    const pop = maxPop > 0 ? (pops[i] ?? 0) / maxPop : 0;
    const followed = s.followedSellers.has(sellerKey(sellerIdentity(p))) || s.followedSellers.has(sellerKey(p.creator)) ? 1 : 0;
    let tastePart = 0;
    if (maxTaste > 0) { const attrs = attrOf(p); tastePart = attrs.length ? Math.min(1, attrs.reduce((sum, a) => sum + (taste.get(a) ?? 0), 0) / (maxTaste * Math.min(attrs.length, 2))) : 0; }
    const seen = s.seen[p.id];
    const keep = s.likedIds.has(p.id) || s.savedIds.has(p.id) ? 0.5 : 1; // liked / saved products are welcome to come back
    const seenPart = seen ? (s.now - seen.at < DAY ? 1 : s.now - seen.at < 7 * DAY ? 0.5 : 0) * keep : 0;
    const own = s.userId && p.source?.user_id === s.userId && freshAt ? 1 : 0;
    const score = WEIGHTS.base * base + WEIGHTS.fresh * freshness + WEIGHTS.coldStart * cold + WEIGHTS.popular * pop
      + WEIGHTS.follow * followed + WEIGHTS.taste * tastePart - WEIGHTS.seen * seenPart
      + WEIGHTS.jitter * seededRandom(s.seed, p.id) + WEIGHTS.ownFresh * own;
    return { id: p.id, score };
  });
}

/** Re-orders `posts` (already in recommended order) for this visitor. Pure: same input gives the same output. */
export function personalFeed(posts: readonly LuxuryPost[], s: FeedSignals): LuxuryPost[] {
  if (posts.length < 3) return [...posts];
  const scores = new Map(scorePosts(posts, s).map(x => [x.id, x.score]));
  const pool = [...posts].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  const out: LuxuryPost[] = [];
  const sellerOf = (p: LuxuryPost) => sellerKey(sellerIdentity(p));
  while (pool.length) {
    const prev = out[out.length - 1], prev2 = out[out.length - 2];
    let pick = -1, fallback = -1;
    // Hard rule: take the best-scoring card whose seller is not among the last two cards, however far down it is.
    for (let i = 0; i < Math.min(WEIGHTS.spreadWindow, pool.length); i++) {
      const who = sellerOf(pool[i]!);
      if (prev && sellerOf(prev) === who) continue;
      if (fallback < 0) fallback = i;
      if (!(prev2 && sellerOf(prev2) === who)) { pick = i; break; }
    }
    out.push(pool.splice(pick >= 0 ? pick : fallback >= 0 ? fallback : 0, 1)[0]!);
  }
  return out;
}

/** Remembers the last result so the (cheap but not free) ordering is not redone on every render of the page. */
export function createFeedMemo() {
  let last: { key: string; out: LuxuryPost[] } | null = null;
  return (posts: readonly LuxuryPost[], s: FeedSignals, version: string) => {
    const key = `${version}|${posts.map(p => p.id).join(',')}`;
    if (last?.key === key) return last.out;
    last = { key, out: personalFeed(posts, s) };
    return last.out;
  };
}
