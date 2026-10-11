import type { LuxuryPost } from './luxury-market';

export type FeedFilter = { fq?: string | undefined; ffactory?: string | undefined; fmin?: number | undefined; fmax?: number | undefined; fshorts?: boolean | undefined; fsort?: 'newest' | 'price_desc' | 'price_asc' | undefined };

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
      const src = p.source as Partial<{brand:string;model:string;reference:string}> | undefined;
      const hay = norm([p.creator, p.title, fac, p.category, specs['brand'], specs['model'], src?.brand, src?.model, src?.reference].filter(v => typeof v === 'string').join(' '));
      if (!q.split(' ').every(word => hay.includes(word))) return false;
    }
    if (factory && !norm(fac).includes(factory)) return false;
    if (f.fmin != null && (p.price == null || p.price < f.fmin)) return false;
    if (f.fmax != null && (p.price == null || p.price > f.fmax)) return false;
    if (f.fshorts && !p.short) return false;
    return true;
  });
}

export const hasFeedFilter = (f: FeedFilter) => Boolean(f.fq || f.ffactory || f.fmin != null || f.fmax != null || f.fshorts || f.fsort);

export type FeedSort = 'newest' | 'price_desc' | 'price_asc';
/** Sorts filtered results; unpriced items always go last for price sorts. Unsorted keeps the recommended order. */
export function sortFeed(posts: LuxuryPost[], sort: FeedSort | undefined): LuxuryPost[] {
  if (!sort) return posts;
  const copy = [...posts];
  if (sort === 'newest') return copy.sort((a, b) => (b.source?.created_at ?? '').localeCompare(a.source?.created_at ?? ''));
  const dir = sort === 'price_desc' ? -1 : 1;
  return copy.sort((a, b) => a.price == null ? 1 : b.price == null ? -1 : (a.price - b.price) * dir);
}
