import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';

export const Route=createFileRoute('/shorts/$id')({
 validateSearch:marketSearch,
 loader:({context})=>context.queryClient.ensureQueryData(postsQuery),
 head:()=>pageHead('VELA Shorts','Watch studio Shorts and explore inspection photos, product details and seller stores on VELA.'),
 errorComponent:()=> <div className="lux-empty">This short could not load. Please try again.</div>,
 component:ShortsRoute,
});
function ShortsRoute(){const {id}=Route.useParams();return <LuxuryMarketplace mode="home" shortsId={id}/>;}