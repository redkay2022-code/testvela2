import { createContext, useContext, useState, type ReactNode } from 'react';
import type { LuxuryPost } from '@/lib/luxury-market';
import type { EscrowStage } from '@/lib/escrow';
export type QcMedia={url:string;type:'image'|'video';name:string};
export type PreviewOrder={id:string;title:string;amount:number;status:string;image?:string|undefined;stage:EscrowStage;qcMedia:QcMedia[];request?:{areas:string[];note:string}|undefined;tracking?:{courier:string;number:string;location:string}|undefined;released:boolean;notices:string[]};
type PreviewState={profile:Profile;saveProfile:(profile:Partial<Profile>)=>void;saved:string[];toggleSaved:(id:string)=>void;following:boolean;follow:()=>void;followedSellers:string[];toggleSeller:(id:string)=>void;cart:LuxuryPost[];addCart:(post:LuxuryPost)=>void;removeCart:(id:string)=>void;orders:PreviewOrder[];order:(post:LuxuryPost)=>void;setStage:(id:string,stage:EscrowStage,notice?:string)=>void;submitQc:(id:string,media:QcMedia[])=>void;requestPhotos:(id:string,areas:string[],note:string)=>void;ship:(id:string,tracking:{courier:string;number:string;location:string})=>void;confirmDelivery:(id:string)=>void;hidden:string[];hide:(id:string)=>void;audits:Record<string,string>;decide:(id:string,status:string)=>void;application:boolean;apply:()=>void};
export type Profile={name:string;region:string;recipient:string;phone:string;address:string;postal:string};
const Context=createContext<PreviewState|null>(null);
const seed:PreviewOrder={id:'VM-1029',title:'Green dial · Oyster bracelet',amount:520,status:'Held in escrow',stage:'qc',qcMedia:[],released:false,notices:['Sample order placed · payment held by VELA']};
export function MarketPreviewProvider({children}:{children:ReactNode}) {
 const [profile,setProfile]=useState<Profile>({name:'Vela Member',region:'Global',recipient:'',phone:'',address:'',postal:''});
  const [followedSellers,setFollowedSellers]=useState<string[]>([]);
 const [saved,setSaved]=useState<string[]>([]),[following,setFollowing]=useState(false),[cart,setCart]=useState<LuxuryPost[]>([]),[orders,setOrders]=useState<PreviewOrder[]>([seed]),[hidden,setHidden]=useState<string[]>([]),[audits,setAudits]=useState<Record<string,string>>({}),[application,setApplication]=useState(false);
 const patch=(id:string,fn:(o:PreviewOrder)=>Partial<PreviewOrder>)=>setOrders(prev=>prev.map(o=>o.id===id?{...o,...fn(o)}:o));
 const setStage=(id:string,stage:EscrowStage,notice?:string)=>patch(id,o=>({stage,notices:notice?[notice,...o.notices]:o.notices}));
 return <Context.Provider value={{profile,saveProfile:next=>setProfile(prev=>({...prev,...next})),saved,toggleSaved:id=>setSaved(prev=>prev.includes(id)?prev.filter(p=>p!==id):[...prev,id]),following,follow:()=>setFollowing(p=>!p),cart,addCart:post=>setCart(prev=>prev.some(p=>p.id===post.id)?prev:[...prev,post]),removeCart:id=>setCart(prev=>prev.filter(p=>p.id!==id)),orders,
  order:post=>{setOrders(prev=>[{id:`VM-${String(prev.length+1).padStart(4,'0')}`,title:post.title,amount:post.price ?? 0,status:'Held in escrow',image:post.images[0],stage:'placed',qcMedia:[],released:false,notices:['Sample order placed · payment held by VELA']},...prev]);setCart(prev=>prev.filter(p=>p.id!==post.id));},
   followedSellers,toggleSeller:id=>{if(id==='VS Watch Studio')setFollowing(p=>!p);else setFollowedSellers(prev=>prev.includes(id)?prev.filter(s=>s!==id):[...prev,id]);},setStage,
  submitQc:(id,media)=>patch(id,o=>({stage:'qc_done',qcMedia:[...o.qcMedia,...media],request:undefined,notices:[`Seller uploaded ${media.length} QC files · review and approve`,...o.notices]})),
  requestPhotos:(id,areas,note)=>patch(id,o=>({stage:'qc_requested',request:{areas,note},notices:[`Additional photos requested: ${areas.join(', ')}`,...o.notices]})),
  ship:(id,tracking)=>patch(id,o=>({stage:'shipped',tracking,notices:[`Shipped via ${tracking.courier} · ${tracking.number}`,...o.notices]})),
  confirmDelivery:id=>patch(id,o=>({stage:'delivered',released:true,status:'Escrow released',notices:['Delivery confirmed · escrow released to seller',...o.notices]})),
  hidden,hide:id=>setHidden(p=>[...p,id]),audits,decide:(id,status)=>{setAudits(p=>({...p,[id]:status}));setOrders(prev=>prev.map(order=>order.id===id?{...order,status}:order));},application,apply:()=>setApplication(true)}}>{children}</Context.Provider>;
}
export function useMarketPreview(){const context=useContext(Context);if(!context) throw new Error('Market preview provider missing');return context;}
