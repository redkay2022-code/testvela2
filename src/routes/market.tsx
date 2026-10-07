import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route = createFileRoute('/market')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('Watch collection','Discover curated mechanical watches and studio collections on velamarket.'),
 errorComponent:()=> <div className="lux-empty">The collection could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This collection is unavailable.</div>,
 component:()=> <LuxuryMarketplace mode="market"/>,
});
