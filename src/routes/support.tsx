import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch,pageHead,postsQuery } from '@/lib/market';
export const Route=createFileRoute('/support')({validateSearch:marketSearch,loader:({context})=>context.queryClient.ensureQueryData(postsQuery),head:()=>pageHead('1:1 지원 · 분쟁 센터','VELA 주문별 판매자 대화와 구매자·판매자·관리자 분쟁 중재 게시판입니다.'),errorComponent:()=> <div className="lux-empty">페이지를 불러오지 못했습니다. 다시 시도해 주세요.</div>,notFoundComponent:()=> <div className="lux-empty">페이지를 찾을 수 없습니다.</div>,component:()=> <LuxuryMarketplace mode="explore" help="support"/>});
