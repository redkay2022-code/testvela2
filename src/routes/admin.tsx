import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
import { Dashboard } from '@/components/role-views';
import { luxuryPosts } from '@/lib/luxury-market';
import { useSuspenseQuery } from '@tanstack/react-query';
export const Route=createFileRoute('/admin')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('VELA 가상화폐 관리자 백오피스','익명 판매자 승인, TXID 검증, 가상화폐 에스크로 정산, 분쟁 중재와 상품·리뷰 관리.'),
 errorComponent:()=> <div className="lux-empty">This view could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This view is unavailable.</div>,
 component:DashboardPage,
});
function DashboardPage(){const {data}=useSuspenseQuery(postsQuery);return <LuxuryMarketplace mode="admin"><Dashboard kind="admin" posts={luxuryPosts(data)}/></LuxuryMarketplace>;}
