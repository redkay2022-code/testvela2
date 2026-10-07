import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';

export const Route=createFileRoute('/store')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
  head:()=>pageHead('VELA Seller Stores','Discover independent sellers, filter their specialties and explore watch, jewelry and custom collections.'),
 errorComponent:()=> <div className="lux-empty">This view could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This view is unavailable.</div>,
 component:()=> <LuxuryMarketplace mode="store"/>,
});

