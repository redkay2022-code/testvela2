import life0 from '@/assets/life-0.webp';
import life1 from '@/assets/life-1.webp';
import life2 from '@/assets/life-2.webp';
import life3 from '@/assets/life-3.webp';
import life4 from '@/assets/life-4.webp';
import life5 from '@/assets/life-5.webp';
import discover0 from '@/assets/discover-0.webp';
import discover1 from '@/assets/discover-1.webp';
import discover2 from '@/assets/discover-2.webp';
import discover3 from '@/assets/discover-3.webp';
import discover4 from '@/assets/discover-4.webp';
import discover5 from '@/assets/discover-5.webp';

export const media: Record<string, string> = {
  'life-0': life0, 'life-1': life1, 'life-2': life2, 'life-3': life3,
  'life-4': life4, 'life-5': life5, 'discover-0': discover0, 'discover-1': discover1,
  'discover-2': discover2, 'discover-3': discover3, 'discover-4': discover4, 'discover-5': discover5,
};
export const categories = ['전체', '패션', '홈·리빙', '뷰티', '푸드', '여행', '디지털', '일상'];
export const priceLabel = (price: number) => `${price.toLocaleString('ko-KR')}원`;