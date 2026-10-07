import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route = createFileRoute('/')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('VELA · 메인 페이지','Discover watches, independent studios and Shorts in VELA’s two-column marketplace feed.'),
 errorComponent:()=> <div className="lux-empty">The collection could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This collection is unavailable.</div>,
 component:()=> <LuxuryMarketplace mode="home"/>,
});
