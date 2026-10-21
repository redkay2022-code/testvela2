import type { LuxuryPost } from './luxury-market';
import { matchesFeedCategory } from './feed-categories';
import { ratingAverage } from './reputation';

export const storeFilters = [['all','전체'],['watches','시계 전문'],['accessories','주얼리/악세사리'],['custom','커스텀'],['solid-gold','18K 골드'],['top','인기 셀러']] as const;
export type StoreCategory = typeof storeFilters[number][0];
export const sellerIdentity = (post: LuxuryPost) => post.sample || post.source.store_id ? post.creator : post.source.user_id ?? post.creator;
export const sellerKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const sellerMatches = (post: LuxuryPost, seller: string) => {
  const target = sellerKey(seller);
  return [sellerIdentity(post), post.creator].some(value => value === seller || sellerKey(value) === target);
};
export type DirectorySeller = { id: string; post: LuxuryPost; items: LuxuryPost[]; rating: number | null; bio: string; reviews: number | null; followers: number | null };
export function directorySellers(posts: LuxuryPost[]): DirectorySeller[] {
  const groups = new Map<string, LuxuryPost[]>();
  for (const post of posts) {
    const id = sellerIdentity(post);
    groups.set(id, [...(groups.get(id) ?? []), post]);
  }
  return Array.from(groups, ([id, items]) => {
    const post = items[0];
    if (!post) return null;
    return { id, post, items, rating: ratingAverage(post.reputation),
      bio: post.description, reviews: null as number | null, followers: null as number | null };
  }).filter((seller): seller is DirectorySeller => seller !== null);
}
export function matchesStoreCategory(seller: DirectorySeller, category: StoreCategory) {
  if (category === 'all') return true;
  if (category === 'top') return seller.items.some(post => post.storeFeatured) || (seller.post.reputation.approved && (seller.rating ?? 0) >= 4.8);
  return seller.items.some(post => matchesFeedCategory(post, category)
    || (category === 'accessories' && /주얼리|쥬얼리|목걸이|반지|bracelet|necklace/i.test(`${post.title} ${post.category}`) && !matchesFeedCategory(post, 'watches'))
    || (category === 'custom' && /custom|커스텀/i.test(post.category))
    || (category === 'solid-gold' && /18k\s*(gold|골드|금)|솔리드\s*골드/i.test(`${post.title} ${post.category} ${post.description}`)));
}