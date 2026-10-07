import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch,pageHead,postsQuery } from '@/lib/market';
export const Route=createFileRoute('/escrow-guide')({validateSearch:marketSearch,loader:({context})=>context.queryClient.ensureQueryData(postsQuery),head:()=>pageHead('가상화폐 에스크로 안내','VELA의 TXID 확인, QC 검수, 배송 추적과 수령 확인 절차를 확인하세요.'),component:()=> <LuxuryMarketplace mode="explore" help="escrow"/>});
