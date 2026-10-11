import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';

export const Route=createFileRoute('/shorts/$id')({
 validateSearch:marketSearch,
 loader:async({context,params})=>{const posts=await context.queryClient.ensureQueryData(postsQuery);const p=posts.find(x=>x.id===params.id);return {title:p?.title ?? null,description:p?(p.description||`${p.creator} · VELA Shorts`).slice(0,160):null,image:p?[p.thumbnail_url,...p.media_urls].find(u=>typeof u==='string'&&u.startsWith('https://')) ?? null:null};},
 head:({params,loaderData})=>{const base=pageHead(loaderData?.title?`${loaderData.title} · Shorts`:'VELA Shorts',loaderData?.description||'Watch studio Shorts and explore inspection photos, product details and seller stores on VELA.');const url=`https://velamarket.lovable.app/shorts/${params.id}`;return {meta:[...base.meta.map(m=>'property' in m&&m.property==='og:type'?{property:'og:type',content:'video.other'}:m),{property:'og:url',content:url},...(loaderData?.image?[{property:'og:image',content:loaderData.image},{name:'twitter:image',content:loaderData.image}]:[])],links:[{rel:'canonical',href:url}]};},
 errorComponent:()=> <div className="lux-empty">This short could not load. Please try again.</div>,
 component:ShortsRoute,
});
function ShortsRoute(){const {id}=Route.useParams();return <LuxuryMarketplace mode="home" shortsId={id}/>;}