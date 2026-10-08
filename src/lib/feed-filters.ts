import type { LuxuryPost } from './luxury-market';

export type FeedFilter = { fq?: string | undefined; ffactory?: string | undefined; fmin?: number | undefined; fmax?: number | undefined; fshorts?: boolean | undefined };

/** Factory label for a post: seller-entered specs.factory wins, then the sample/editorial factory field. */
export function postFactory(post: LuxuryPost): string {
  const specs = (post.source?.specs ?? {}) as Record<string, unknown>;
  const f = typeof specs['factory'] === 'string' ? specs['factory'] : '';
  if (f) return f;
  if (specs['sourceType'] === 'custom') return '커스텀 제작';
  return post.sample ? post.factory : '';
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Filters by seller, product name, factory (text) plus factory, USD price range and Shorts-only. */
export function filterFeed(posts: LuxuryPost[], f: FeedFilter): LuxuryPost[] {
  const q = norm(f.fq ?? '');
  const factory = norm(f.ffactory ?? '');
  return posts.filter(p => {
    const fac = postFactory(p);
    if (q) {
      const specs = (p.source?.specs ?? {}) as Record<string, unknown>;
      const hay = norm([p.creator, p.title, fac, specs['brand'], specs['model']].filter(v => typeof v === 'string').join(' '));
      if (!q.split(' ').every(word => hay.includes(word))) return false;
    }
    if (factory && !norm(fac).includes(factory)) return false;
    if (f.fmin != null && (p.price == null || p.price < f.fmin)) return false;
    if (f.fmax != null && (p.price == null || p.price > f.fmax)) return false;
    if (f.fshorts && !p.short) return false;
    return true;
  });
}

export const hasFeedFilter = (f: FeedFilter) => Boolean(f.fq || f.ffactory || f.fmin != null || f.fmax != null || f.fshorts);
