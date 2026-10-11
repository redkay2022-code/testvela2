import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { SellerWorkflowPage } from '@/components/seller-workflow-pages';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route=createFileRoute('/seller-messages')({validateSearch:marketSearch,loader:({context})=>context.queryClient.ensureQueryData(postsQuery),head:()=>pageHead('VELA 셀러 메시지함','좋아요·저장, 새 팔로워, 댓글·문의와 구매자 주문별 대화를 확인합니다.'),component:()=> <LuxuryMarketplace mode="seller"><SellerWorkflowPage page="messages"/></LuxuryMarketplace>});