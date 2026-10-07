import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch,pageHead,postsQuery } from '@/lib/market';
export const Route=createFileRoute('/privacy')({validateSearch:marketSearch,loader:({context})=>context.queryClient.ensureQueryData(postsQuery),head:()=>pageHead('개인정보 보호 안내','VELA의 SHA-256 전화번호 식별, 익명 프로필 및 비공개 QC 자료 처리 안내입니다.'),component:()=> <LuxuryMarketplace mode="explore" help="privacy"/>});
