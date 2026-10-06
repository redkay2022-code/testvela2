import { createFileRoute } from '@tanstack/react-router';
import { Marketplace } from '@/components/marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route = createFileRoute('/upload')({
  validateSearch:marketSearch,
  loader:({context}) => context.queryClient.ensureQueryData(postsQuery),
  head:() => pageHead('이야기 올리기','좋아하는 순간이나 판매할 물건을 사진과 함께 공유하세요.'),
  component:() => <Marketplace mode="upload"/>,
});