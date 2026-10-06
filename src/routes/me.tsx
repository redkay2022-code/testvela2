import { createFileRoute } from '@tanstack/react-router';
import { Marketplace } from '@/components/marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route = createFileRoute('/me')({
  validateSearch:marketSearch,
  loader:({context}) => context.queryClient.ensureQueryData(postsQuery),
  head:() => pageHead('나의 취향','마음에 드는 게시물을 모으고 나의 이야기를 관리하세요.'),
  component:() => <Marketplace mode="me"/>,
});