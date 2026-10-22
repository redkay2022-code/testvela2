import type { LuxuryPost } from './luxury-market';
import { matchesFeedCategory, primaryCategories } from './feed-categories';
import { ratingAverage } from './reputation';

/** 스토어 목록의 카테고리는 메인 페이지 상단 카테고리와 같다(전체·시계·악세사리·가방·의류·파츠·커스텀 제작·기타, 뉴스·바로발송·스토리는 제외). 주소의 'all'은 '전체'. */
export const storeFilters: readonly (readonly [string, string])[] = primaryCategories.filter(([id]) => !['news', 'ready', 'story'].includes(id)).map(([id, label]) => [id === 'recommend' ? 'all' : id, label] as const);
export type StoreCategory = string;
export const sellerIdentity = (post: LuxuryPost) => post.sample || post.source.store_id ? post.creator : post.source.user_id ?? post.creator;
export const sellerKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 스토어 주소용 짧은 코드: 계정 ID면 앞 8자리, 이름이면 영문 소문자-하이픈(한글 등은 이름 그대로). */
export const storeSlugOf = (post: LuxuryPost) => { const id = sellerIdentity(post); return UUID_RE.test(id) ? id.slice(0, 8).toLowerCase() : sellerKey(id) || id; };
export const sellerMatches = (post: LuxuryPost, seller: string) => {
  const target = sellerKey(seller);
  const short = /^[0-9a-f]{8}$/i.test(seller) ? seller.toLowerCase() : null;
  return [sellerIdentity(post), post.creator, post.source.user_id ?? ''].some(value => value === seller || sellerKey(value) === target || (short !== null && UUID_RE.test(value) && value.toLowerCase().startsWith(short)));
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
  if (category === 'all' || !storeFilters.some(([id]) => id === category)) return true;
  return seller.items.some(post => matchesFeedCategory(post, category));
}
