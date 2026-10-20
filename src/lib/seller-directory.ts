import type { LuxuryPost } from './luxury-market';
import { matchesFeedCategory } from './feed-categories';
import { ratingAverage } from './reputation';

export const storeFilters = [['all','전체'],['watches','시계 전문'],['accessories','주얼리/악세사리'],['custom','커스텀'],['solid-gold','18K 골드'],['top','인기 셀러']] as const;
export type StoreCategory = typeof storeFilters[number][0];
export const sellerIdentity = (post: LuxuryPost) => post.sample || post.source.store_id ? post.creator : post.source.user_id ?? post.creator;
export const sellerKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 스토어 주소용 짧은 코드: 계정 ID면 앞 8자리, 이름이면 영문 소문자-하이픈(한글 등은 이름 그대로). */
export const storeSlugOf = (post: LuxuryPost) => { const id = sellerIdentity(post); return UUID_RE.test(id) ? id.slice(0, 8).toLowerCase() : sellerKey(id) || id; };
export const sellerMatches = (post: LuxuryPost, seller: string) => {
  const target = sellerKey(seller);
  const short = /^[0-9a-f]{8}$/i.test(seller) ? seller.toLowerCase() : null;
  return [sellerIdentity(post), post.creator].some(value => value === seller || sellerKey(value) === target || (short !== null && UUID_RE.test(value) && value.toLowerCase().startsWith(short)));
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