import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
import { Dashboard } from '@/components/role-views';
import { luxuryPosts } from '@/lib/luxury-market';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SellerListings } from '@/components/seller-listings';
export const Route=createFileRoute('/seller')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('Studio dashboard','Manage your sample watch listings, shipping and studio earnings.'),
 errorComponent:()=> <div className="lux-empty">This view could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This view is unavailable.</div>,
 component:DashboardPage,
});
function DashboardPage(){const {data}=useSuspenseQuery(postsQuery);return <LuxuryMarketplace mode="seller"><SellerListings/><Dashboard kind="seller" posts={luxuryPosts(data)}/></LuxuryMarketplace>;}
