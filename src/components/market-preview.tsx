import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CurrencyProvider } from './currency';
import type { LuxuryPost } from '@/lib/luxury-market';
import type { EscrowStage } from '@/lib/escrow';
import { sellerIdentity, sellerKey } from '@/lib/seller-directory';
import { supabase } from '@/integrations/supabase/client';
const syncDb=(fn:(uid:string)=>PromiseLike<unknown>)=>{void supabase.auth.getUser().then(({data})=>data.user?fn(data.user.id):undefined);};
import watch0 from '@/assets/watch-0.webp';
export type QcMedia={url:string;type:'image'|'video';name:string};
export type PreviewOrder={id:string;title:string;amount:number;status:string;image?:string|undefined;stage:EscrowStage;qcMedia:QcMedia[];request?:{areas:string[];note:string}|undefined;tracking?:{courier:string;number:string;location:string}|undefined;released:boolean;notices:string[];sellerId?:string|undefined;sellerName?:string|undefined;reviewed?:boolean|undefined};
type PreviewState={profile:Profile;saveProfile:(profile:Partial<Profile>)=>void;saved:string[];toggleSaved:(id:string)=>void;following:boolean;follow:()=>void;followedSellers:string[];toggleSeller:(id:string)=>void;isFollowing:(id:string)=>boolean;cart:LuxuryPost[];addCart:(post:LuxuryPost)=>void;removeCart:(id:string)=>void;orders:PreviewOrder[];order:(post:LuxuryPost)=>void;setStage:(id:string,stage:EscrowStage,notice?:string)=>void;submitQc:(id:string,media:QcMedia[])=>void;requestPhotos:(id:string,areas:string[],note:string)=>void;ship:(id:string,tracking:{courier:string;number:string;location:string})=>void;confirmDelivery:(id:string)=>void;markReviewed:(id:string)=>void;hidden:string[];hide:(id:string)=>void;audits:Record<string,string>;decide:(id:string,status:string)=>void;application:boolean;apply:()=>void};
export type Profile={name:string;region:string;recipient:string;phone:string;address:string;postal:string};
const Context=createContext<PreviewState|null>(null);
const seed:PreviewOrder={id:'VM-1029',title:'Green dial · Oyster bracelet',amount:520,status:'Held in escrow',stage:'qc',qcMedia:[],released:false,notices:['Sample order placed · payment held by VELA'],sellerId:'VS Watch Studio',sellerName:'VS Watch Studio'};
const seedDelivered:PreviewOrder={id:'VM-0987',title:'Rolex Submariner 41 Black Dial',amount:412,status:'Escrow released',image:watch0,stage:'delivered',qcMedia:[],released:true,notices:['Delivery confirmed · escrow released to seller'],sellerId:'Geneva Atelier',sellerName:'Geneva Atelier'};
export function MarketPreviewProvider({children}:{children:ReactNode}) {
 const [profile,setProfile]=useState<Profile>({name:'Vela Member',region:'Global',recipient:'',phone:'',address:'',postal:''});
  const [followedSellers,setFollowedSellers]=useState<string[]>([]);
  useEffect(()=>{try{const v=JSON.parse(localStorage.getItem('vela-followed-sellers') ?? '[]');if(Array.isArray(v))setFollowedSellers(v.filter((x):x is string=>typeof x==='string'));}catch{/* ignore */}},[]);
  const writeFollows=(next:string[])=>{try{localStorage.setItem('vela-followed-sellers',JSON.stringify(next));}catch{/* ignore */}return next;};
  const isFollowing=(id:string)=>followedSellers.some(s=>s===id||sellerKey(s)===sellerKey(id));
 const [saved,setSaved]=useState<string[]>([]),[cart,setCart]=useState<LuxuryPost[]>([]),[orders,setOrders]=useState<PreviewOrder[]>([seed,seedDelivered]),[hidden,setHidden]=useState<string[]>([]),[audits,setAudits]=useState<Record<string,string>>({}),[application,setApplication]=useState(false);
 const patch=(id:string,fn:(o:PreviewOrder)=>Partial<PreviewOrder>)=>setOrders(prev=>prev.map(o=>o.id===id?{...o,...fn(o)}:o));
 const setStage=(id:string,stage:EscrowStage,notice?:string)=>patch(id,o=>({stage,notices:notice?[notice,...o.notices]:o.notices}));
 return <Context.Provider value={{profile,saveProfile:next=>setProfile(prev=>({...prev,...next})),saved,toggleSaved:id=>setSaved(prev=>prev.includes(id)?prev.filter(p=>p!==id):[...prev,id]),following:isFollowing('VS Watch Studio'),follow:()=>setFollowedSellers(prev=>writeFollows(prev.some(s=>sellerKey(s)===sellerKey('VS Watch Studio'))?prev.filter(s=>sellerKey(s)!==sellerKey('VS Watch Studio')):[...prev,'VS Watch Studio'])),cart,addCart:post=>{if(!post.sample)syncDb(uid=>supabase.from('cart_items').upsert({user_id:uid,post_id:post.id},{ignoreDuplicates:true}));setCart(prev=>prev.some(p=>p.id===post.id)?prev:[...prev,post]);},removeCart:id=>{syncDb(uid=>supabase.from('cart_items').delete().eq('user_id',uid).eq('post_id',id));setCart(prev=>prev.filter(p=>p.id!==id));},orders,
  order:post=>{setOrders(prev=>[{id:`VM-${String(prev.length+1).padStart(4,'0')}`,title:post.title,amount:post.price ?? 0,status:'Held in escrow',image:post.images[0],stage:'placed',qcMedia:[],released:false,notices:['Sample order placed · payment held by VELA'],sellerId:sellerIdentity(post),sellerName:post.creator},...prev]);setCart(prev=>prev.filter(p=>p.id!==post.id));},
   followedSellers,isFollowing,toggleSeller:id=>{const on=isFollowing(id);syncDb(uid=>on?supabase.from('seller_follows').delete().eq('follower_id',uid).eq('seller_key',id):supabase.from('seller_follows').insert({follower_id:uid,seller_key:id}));setFollowedSellers(prev=>writeFollows(prev.some(s=>s===id||sellerKey(s)===sellerKey(id))?prev.filter(s=>s!==id&&sellerKey(s)!==sellerKey(id)):[...prev,id]));},setStage,
  submitQc:(id,media)=>patch(id,o=>({stage:'qc_done',qcMedia:[...o.qcMedia,...media],request:undefined,notices:[`Seller uploaded ${media.length} QC files · review and approve`,...o.notices]})),
  requestPhotos:(id,areas,note)=>patch(id,o=>({stage:'qc_requested',request:{areas,note},notices:[`Additional photos requested: ${areas.join(', ')}`,...o.notices]})),
  ship:(id,tracking)=>patch(id,o=>({stage:'shipped',tracking,notices:[`Shipped via ${tracking.courier} · ${tracking.number}`,...o.notices]})),
  confirmDelivery:id=>patch(id,o=>({stage:'delivered',released:true,status:'Escrow released',notices:['Delivery confirmed · escrow released to seller',...o.notices]})),
  markReviewed:id=>patch(id,()=>({reviewed:true})),
  hidden,hide:id=>setHidden(p=>[...p,id]),audits,decide:(id,status)=>{setAudits(p=>({...p,[id]:status}));setOrders(prev=>prev.map(order=>order.id===id?{...order,status}:order));},application,apply:()=>setApplication(true)}}><CurrencyProvider>{children}</CurrencyProvider></Context.Provider>;
}
export function useMarketPreview(){const context=useContext(Context);if(!context) throw new Error('Market preview provider missing');return context;}
