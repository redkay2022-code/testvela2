import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';

/** 셀러 스토어 독립 주소: /s/<셀러 식별자> — 링크를 열면 바로 해당 스토어가 나타납니다. */
export const Route = createFileRoute('/s/$slug')({
  validateSearch: marketSearch,
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  head: () => pageHead('VELA Seller Store', 'Browse this independent seller\'s collection on VELA.'),
  errorComponent: () => <div className="lux-empty">This view could not load. Please try again.</div>,
  notFoundComponent: () => <div className="lux-empty">This view is unavailable.</div>,
  component: SellerSlugPage,
});

function SellerSlugPage() {
  const { slug } = Route.useParams();
  return <LuxuryMarketplace mode="store" storeSlug={slug} />;
}
