import type { LuxuryPost } from '@/lib/luxury-market';
import { mixSellers } from '@/lib/feed-ranking';
import { seededRandom } from '@/lib/personal-feed';

/** 홈 추천 피드: 영상/사진/상단노출 구분 없이 모든 자료를 시드 기준으로 무작위 정렬 (같은 판매자 연속 노출만 방지). */
export function randomFeed(posts: LuxuryPost[], seed: string, gap = 2): LuxuryPost[] {
  const shuffled = posts
    .map(p => ({ p, r: seededRandom(seed, p.id) }))
    .sort((a, b) => a.r - b.r)
    .map(e => e.p);
  return mixSellers(shuffled, gap);
}
