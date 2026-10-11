import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route = createFileRoute('/me')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('내 VELA · 저장한 컬렉션과 구매 내역','VELA에서 저장한 상품, 구매 현황, 배송 추적과 출고 QC, 문의 내역 및 멤버십 혜택을 확인하세요.'),
 errorComponent:()=> <div className="lux-empty">The collection could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This collection is unavailable.</div>,
 component:()=> <LuxuryMarketplace mode="me"/>,
});
