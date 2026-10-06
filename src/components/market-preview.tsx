import { createContext, useContext, useState, type ReactNode } from 'react';
import type { LuxuryPost } from '@/lib/luxury-market';
export type PreviewOrder={id:string;title:string;amount:number;status:string};
type PreviewState={saved:string[];toggleSaved:(id:string)=>void;following:boolean;follow:()=>void;cart:LuxuryPost[];addCart:(post:LuxuryPost)=>void;removeCart:(id:string)=>void;orders:PreviewOrder[];order:(post:LuxuryPost)=>void;hidden:string[];hide:(id:string)=>void;audits:Record<string,string>;decide:(id:string,status:string)=>void;application:boolean;apply:()=>void};
const Context=createContext<PreviewState|null>(null);
export function MarketPreviewProvider({children}:{children:ReactNode}) {
 const [saved,setSaved]=useState<string[]>([]),[following,setFollowing]=useState(false),[cart,setCart]=useState<LuxuryPost[]>([]),[orders,setOrders]=useState<PreviewOrder[]>([]),[hidden,setHidden]=useState<string[]>([]),[audits,setAudits]=useState<Record<string,string>>({}),[application,setApplication]=useState(false);
 return <Context.Provider value={{saved,toggleSaved:id=>setSaved(prev=>prev.includes(id)?prev.filter(p=>p!==id):[...prev,id]),following,follow:()=>setFollowing(p=>!p),cart,addCart:post=>setCart(prev=>prev.some(p=>p.id===post.id)?prev:[...prev,post]),removeCart:id=>setCart(prev=>prev.filter(p=>p.id!==id)),orders,order:post=>{setOrders(prev=>[{id:`VM-${String(prev.length+1).padStart(4,'0')}`,title:post.title,amount:post.price ?? 0,status:'Awaiting payment'},...prev]);setCart(prev=>prev.filter(p=>p.id!==post.id));},hidden,hide:id=>setHidden(p=>[...p,id]),audits,decide:(id,status)=>setAudits(p=>({...p,[id]:status})),application,apply:()=>setApplication(true)}}>{children}</Context.Provider>;
}
export function useMarketPreview(){const context=useContext(Context);if(!context) throw new Error('Market preview provider missing');return context;}
