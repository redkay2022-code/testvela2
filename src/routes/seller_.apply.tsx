import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { SellerApplyPage } from '@/components/seller-apply';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
export const Route=createFileRoute('/seller_/apply')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('Become a Vela seller · Seller application','Apply for a VELA seller account: tell us about your business and choose the Basic, Pro or Enterprise plan.'),
 errorComponent:()=> <div className="lux-empty">This view could not load. Please try again.</div>,
 notFoundComponent:()=> <div className="lux-empty">This view is unavailable.</div>,
 component:()=> <LuxuryMarketplace mode="seller"><SellerApplyPage/></LuxuryMarketplace>,
});
