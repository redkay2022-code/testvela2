import { useEffect, useRef, useState } from 'react';
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { Button } from './ui/button';
import { marketSearch } from '@/lib/market';

export function ShortsGallery({images,title}:{images:string[];title:string}) {
 const photos=images.slice(0,15),[slide,setSlide]=useState(0),carousel=useRef<HTMLDivElement>(null);
 const location=useRouterState({select:s=>s.location}),search=marketSearch.parse(location.search);
 const navigate=useNavigate(),router=useRouter(),pushed=useRef(false);
 const photo=search.shortPhoto;
 useEffect(()=>{if(photo===undefined)pushed.current=false;},[photo]);
 const open=(index:number)=>{pushed.current=true;void navigate({to:'.',search:prev=>({...prev,shortPhoto:index}),resetScroll:false});};
 const close=()=>{if(pushed.current){pushed.current=false;router.history.back();}else void navigate({to:'.',search:prev=>({...prev,shortPhoto:undefined}),replace:true,resetScroll:false});};
 const change=(index:number)=>void navigate({to:'.',search:prev=>({...prev,shortPhoto:Math.max(0,Math.min(photos.length-1,index))}),replace:true,resetScroll:false});
 const move=(index:number)=>carousel.current?.scrollTo({left:index*carousel.current.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 if(!photos.length)return <p className="text-sm text-muted-foreground">No inspection photos available.</p>;
 return <section className="shorts-gallery" aria-label="Product inspection photos">
  <div className="shorts-gallery-wrap"><div className="shorts-gallery-track" ref={carousel} onScroll={e=>setSlide(Math.max(0,Math.min(photos.length-1,Math.round(e.currentTarget.scrollLeft/e.currentTarget.clientWidth))))}>
   {photos.map((src,i)=><Button key={i} variant="ghost" className="shorts-gallery-photo" aria-label={`Expand inspection photo ${i+1}`} onClick={()=>open(i)}><img src={src} alt={`${title} · inspection ${i+1}`} loading={i===0?'eager':'lazy'}/></Button>)}
  </div><span className="lux-counter" aria-live="polite">{slide+1} / {photos.length}</span><Button variant="ghost" size="icon" className="shorts-gallery-expand" aria-label="Expand current inspection photo" title="Expand photo" onClick={()=>open(slide)}><Expand/></Button></div>
  <div className="shorts-gallery-pagination"><Button variant="ghost" size="icon" aria-label="Previous inspection photo" disabled={slide===0} onClick={()=>move(slide-1)}><ChevronLeft/></Button><div className="shorts-gallery-dots">{photos.map((_,i)=><Button key={i} variant="ghost" size="icon" className="shorts-gallery-dot" aria-label={`Show inspection photo ${i+1}`} aria-current={slide===i?'true':undefined} onClick={()=>move(i)}><span/></Button>)}</div><Button variant="ghost" size="icon" aria-label="Next inspection photo" disabled={slide===photos.length-1} onClick={()=>move(slide+1)}><ChevronRight/></Button></div>
  {photo!==undefined&&<Dialog.Root open onOpenChange={isOpen=>{if(!isOpen)close();}}><Dialog.Portal><Dialog.Content className="shorts-lightbox" aria-describedby={undefined} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();change(photo-1);}if(e.key==='ArrowRight'){e.preventDefault();change(photo+1);}}}>
   <header><Dialog.Title className="sr-only">Inspection photo fullscreen</Dialog.Title><span>{Math.min(photo+1,photos.length)} / {photos.length}</span><Button variant="ghost" size="icon" aria-label="Close inspection photo" onClick={close}><X/></Button></header>
   <div className="shorts-lightbox-media" onTouchStart={e=>{e.currentTarget.dataset.start=String(e.touches[0]?.clientX ?? 0);}} onTouchEnd={e=>{const delta=(e.changedTouches[0]?.clientX ?? 0)-Number(e.currentTarget.dataset.start);if(Math.abs(delta)>50)change(photo+(delta<0?1:-1));}}><img src={photos[Math.min(photo,photos.length-1)]} alt={`${title} · inspection ${photo+1}`}/></div>
   <footer><Button variant="ghost" size="icon" aria-label="Previous fullscreen photo" disabled={photo===0} onClick={()=>change(photo-1)}><ChevronLeft/></Button><Button variant="ghost" size="icon" aria-label="Next fullscreen photo" disabled={photo>=photos.length-1} onClick={()=>change(photo+1)}><ChevronRight/></Button></footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>}
 </section>;
}