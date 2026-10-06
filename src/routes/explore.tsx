import { createFileRoute } from '@tanstack/react-router';
import { Marketplace } from '@/components/marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route = createFileRoute('/explore')({
  validateSearch:marketSearch,
  loader:({context}) => context.queryClient.ensureQueryData(postsQuery),
  head:() => pageHead('취향 탐색','상품, 공간, 크리에이터를 검색하고 새로운 취향을 발견하세요.'),
  component:() => <Marketplace mode="explore"/>,
});