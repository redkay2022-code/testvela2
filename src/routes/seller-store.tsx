import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { SellerWorkflowPage } from '@/components/seller-workflow-pages';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route=createFileRoute('/seller-store')({validateSearch:marketSearch,loader:({context})=>context.queryClient.ensureQueryData(postsQuery),head:()=>pageHead('VELA 스토어 관리','상품 등록과 편집, 판매 공개 상태, 고객 질문 및 물류·배송을 관리합니다.'),component:()=> <LuxuryMarketplace mode="seller"><SellerWorkflowPage page="store"/></LuxuryMarketplace>});