import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
import { Dashboard } from '@/components/role-views';
import { luxuryPosts } from '@/lib/luxury-market';
import { useSuspenseQuery } from '@tanstack/react-query';
export const Route=createFileRoute('/admin')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('Vela platform management','Sample back office for seller KYC, product verification, moderation and settlements.'),
 errorComponent:()=> <div className="lux-empty">This view could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This view is unavailable.</div>,
 component:DashboardPage,
});
function DashboardPage(){const {data}=useSuspenseQuery(postsQuery);return <LuxuryMarketplace mode="admin"><Dashboard kind="admin" posts={luxuryPosts(data)}/></LuxuryMarketplace>;}
