import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
import { Dashboard } from '@/components/role-views';
import { luxuryPosts } from '@/lib/luxury-market';
import { useSuspenseQuery } from '@tanstack/react-query';
export const Route=createFileRoute('/seller')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('VELA Seller Studio · 내 스튜디오','셀러 등급, 매출과 고객 리뷰, 상품 등록, 주문·검수·배송 및 메시지를 관리하는 VELA 셀러 스튜디오.'),
 errorComponent:()=> <div className="lux-empty">This view could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This view is unavailable.</div>,
 component:DashboardPage,
});
function DashboardPage(){const {data}=useSuspenseQuery(postsQuery);return <LuxuryMarketplace mode="seller"><Dashboard kind="seller" posts={luxuryPosts(data)}/></LuxuryMarketplace>;}
