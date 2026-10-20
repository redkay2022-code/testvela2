import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sellerKey } from '@/lib/seller-directory';

/**
 * 테스트용 표시 숫자 (113차).
 * true 이면 팔로워/좋아요/저장 숫자를 실제 값 대신 50~100 사이 고정 난수로 보여 준다.
 * 같은 계정(셀러)·같은 게시물은 어느 화면, 어느 기기, 누가 봐도 항상 같은 숫자다.
 * 테스트가 끝나면 false 로 바꾸거나 이 작업을 되돌리면 실제 숫자로 돌아온다.
 */
export const TEST_COUNTS_ENABLED = true;

const hash = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
/** 50~100 (양끝 포함) */
export const testRange = (seed: string) => 50 + (hash(seed) % 51);

export type TestSellerStat = { followers: number; likes: number; saves: number };
/** 셀러(계정) 한 곳의 팔로워·좋아요·저장 합계 */
export const testSellerStat = (key: string): TestSellerStat => { const k = sellerKey(key) || key; return { followers: testRange(`f|${k}`), likes: testRange(`l|${k}`), saves: Math.floor(testRange(`l|${k}`) / 3) }; };
/** 게시물 한 개의 좋아요/저장 */
export const testPostLikes = (postId: string) => testRange(`pl|${postId}`);
/** 저장 수는 항상 좋아요 수의 3분의 1(내림). */
export const testPostSaves = (postId: string) => Math.floor(testPostLikes(postId) / 3);
/** 게시물 조회수: 500~1000 (양끝 포함) */
export const testPostViews = (postId: string) => 500 + (hash(`pv|${postId}`) % 501);
/** 셀러 계정 전체 조회수: 500~1000 */
export const testSellerViews = (key: string) => 500 + (hash(`sv|${sellerKey(key) || key}`) % 501);
/** 화면에 보여 줄 조회수 (테스트 모드가 꺼져 있으면 실제 값 그대로) */
export const shownViews = (postId: string, real: string | number) => (TEST_COUNTS_ENABLED ? String(testPostViews(postId)) : String(real));
/** 화면에 보여 줄 게시물 좋아요 수 (테스트 모드가 꺼져 있으면 실제 값 그대로) */
export const shownPostLikes = (postId: string, real: number) => (TEST_COUNTS_ENABLED ? testPostLikes(postId) : real);

/** 내가 좋아요/저장을 누르면 숫자가 1 올라가고, 취소하면 내려간다(테스트 모드에서도 동일). */
export const likeAdj = (on: boolean) => (on ? 1 : 0);

/** 내 셀러 계정의 키 (공개 스토어/셀러 목록과 같은 규칙: 스토어 상품이면 이름, 아니면 사용자 ID) */
export function useOwnSellerKey(userId: string): string {
  const q = useQuery({
    queryKey: ['own-seller-key', userId], staleTime: 10 * 60_000, enabled: TEST_COUNTS_ENABLED,
    queryFn: async () => {
      const { data } = await supabase.from('posts').select('creator,store_id').eq('user_id', userId).limit(1);
      const row = data?.[0] as { creator?: string | null; store_id?: string | null } | undefined;
      return row?.store_id && row.creator ? row.creator : userId;
    },
  });
  return q.data ?? userId;
}
