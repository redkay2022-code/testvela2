import { createFileRoute } from '@tanstack/react-router';
import { Marketplace } from '@/components/marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route = createFileRoute('/market')({
  validateSearch:marketSearch,
  loader:({context}) => context.queryClient.ensureQueryData(postsQuery),
  head:() => pageHead('취향 마켓','패션, 리빙, 디지털. 크리에이터가 고른 물건을 벨라마켓에서 만나보세요.'),
  component:() => <Marketplace mode="market"/>,
});