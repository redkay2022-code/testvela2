import { createFileRoute } from "@tanstack/react-router";
import { Marketplace } from '@/components/marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route = createFileRoute("/")({
  validateSearch: marketSearch,
  loader: ({context}) => context.queryClient.ensureQueryData(postsQuery),
  head: () => pageHead('오늘의 발견','좋아하는 순간과 물건을 발견하는 곳. 취향으로 연결되는 벨라마켓에서 새로운 일상을 만나보세요.'),
  component: () => <Marketplace />,
});
