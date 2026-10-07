import { EscrowGuarantee } from './escrow';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Check, ChevronRight, Heart, MessageCircle, Play, Plus, Share2, ShoppingBag, X } from 'lucide-react';
import { Link, useRouterState } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { ProductComments } from './product-comments';
import { useMarketPreview } from './market-preview';
import { dollars, type LuxuryPost } from '@/lib/luxury-market';
import { SellerBadge, SellerRatings } from './reputation';
import { ShortsGallery } from './shorts-gallery';
import { marketSearch } from '@/lib/market';

type Props = { posts:LuxuryPost[]; selectedId:string; sheet:'product'|'comments'|undefined; user:User|null; close:()=>void; closeSheet:()=>void; change:(id:string)=>void; openSheet:(sheet:'product'|'comments')=>void; requestAuth:()=>void; buy:()=>void; notify:(text:string)=>void };
export function ShortsPlayer({posts,selectedId,sheet,user,close,closeSheet,change,openSheet,requestAuth,buy,notify}:Props) {
 const feed=useRef<HTMLDivElement>(null), initialized=useRef(false), activeId=useRef(selectedId);
 const touch=useRef<{x:number;y:number}|null>(null);
 const [active,setActive]=useState(selectedId);
 const reduced=useReducedMotion();
 const post=posts.find(p=>p.id===active) || posts[0];
 useEffect(()=>{activeId.current=selectedId;setActive(selectedId);const el=feed.current;const index=posts.findIndex(p=>p.id===selectedId);if(el&&index>=0){el.scrollTo({top:index*el.clientHeight,behavior:'instant'});initialized.current=true;}},[selectedId,posts.length]);
 if(!post)return null;
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Content asChild aria-describedby={undefined}><motion.div className="shorts-player" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onTouchStart={e=>{if(sheet||e.touches.length!==1||(e.target instanceof Element&&e.target.closest('button,a')))return;const t=e.touches[0];if(t)touch.current={x:t.clientX,y:t.clientY};}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{const start=touch.current;touch.current=null;const end=e.changedTouches[0];if(!sheet&&start&&end){const dx=end.clientX-start.x,dy=end.clientY-start.y;if(dx>80&&dx>Math.abs(dy)*1.5)close();}}}>
 <Dialog.Title className="sr-only">VELA Shorts</Dialog.Title>
 <Button variant="ghost" size="icon" className="shorts-exit" aria-label="Close Shorts and return Home" title="Return Home" onClick={close}><ArrowLeft/></Button>
  <div className={`shorts-snap ${sheet?'shorts-locked':''}`} ref={el=>{feed.current=el;if(el&&!initialized.current){initialized.current=true;const index=posts.findIndex(p=>p.id===selectedId);requestAnimationFrame(()=>el.scrollTo({top:Math.max(0,index)*el.clientHeight,behavior:'instant'}));}}} onScroll={e=>{if(sheet||!initialized.current)return;const el=e.currentTarget;const index=Math.round(el.scrollTop/el.clientHeight),next=posts[index];if(next&&Math.abs(el.scrollTop-index*el.clientHeight)<el.clientHeight*.35&&next.id!==activeId.current){activeId.current=next.id;setActive(next.id);change(next.id);}}} tabIndex={0} aria-label="Shorts video feed" onKeyDown={e=>{if(sheet)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();feed.current?.scrollBy({top:(e.key==='ArrowDown'?1:-1)*e.currentTarget.clientHeight,behavior:reduced?'instant':'smooth'});}}}>
 {posts.map(p=><ShortScene key={p.id} post={p} active={p.id===active} muted openSheet={openSheet} notify={notify}/>)}
 </div>
 <AnimatePresence>{sheet&&<ShortSheet key={sheet} kind={sheet} close={closeSheet}>
 {sheet==='comments'?<ProductComments postId={post.id} user={user} requestAuth={requestAuth}/>:<ProductSummary post={post} buy={buy} notify={notify}/>}
 </ShortSheet>}</AnimatePresence>
 </motion.div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function ShortScene({post,active,muted,openSheet,notify}:{post:LuxuryPost;active:boolean;muted:boolean;openSheet:Props['openSheet'];notify:Props['notify']}) {
 const video=useRef<HTMLVideoElement>(null),preview=useMarketPreview();
 const [failed,setFailed]=useState(false),[blocked,setBlocked]=useState(false);
 const liked=preview.saved.includes(post.id);
 useEffect(()=>{const v=video.current;if(!v)return;v.muted=muted;let cancelled=false;const play=()=>{if(active&&!document.hidden){void v.play().then(()=>{if(!cancelled)setBlocked(false);}).catch(()=>{if(!cancelled)setBlocked(true);});}else v.pause();};play();document.addEventListener('visibilitychange',play);return()=>{cancelled=true;v.pause();document.removeEventListener('visibilitychange',play);};},[active,muted,post.video]);
 return <article className="shorts-scene" data-short-id={post.id} aria-label={post.title} aria-hidden={!active}>
 {post.video&&!failed?<video ref={video} poster={post.images[0]} playsInline loop muted={muted} preload={active?'auto':'none'} onError={()=>setFailed(true)}><source src={post.video} type={post.videoFallback?"video/webm":undefined}/>{post.videoFallback&&<source src={post.videoFallback} type="video/mp4"/>}</video>:<img src={post.images[0]} alt={post.title}/>}
 {(blocked||failed||!post.video)&&<div className="shorts-media-state">{blocked&&!failed?<Button variant="ghost" aria-label="Play video" onClick={()=>{void video.current?.play().then(()=>setBlocked(false)).catch(()=>notify('Playback is unavailable on this device.'));}}><Play/> Play</Button>:<span>{failed?'Video unavailable · Cover preview':'Studio cover preview'}</span>}</div>}
 <aside className="shorts-actions" aria-label="Shorts actions">
 <Button variant="ghost" className="shorts-follow" aria-label={preview.following?'Unfollow creator':'Follow creator'} aria-pressed={preview.following} tabIndex={active?0:-1} onClick={preview.follow}><img src={post.images[0]} alt={post.creator}/><span>{preview.following?<Check size={12}/>:<Plus size={12}/>}</span></Button>
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="Like short" aria-pressed={liked} tabIndex={active?0:-1} className={liked?'shorts-liked':''} onClick={()=>preview.toggleSaved(post.id)}><motion.span key={String(liked)} animate={{scale:liked?[1,1.3,1]:1}}><Heart fill={liked?'currentColor':'none'}/></motion.span></Button><span>{post.likes+(liked?1:0)}</span></div>
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="Open Shorts comments" tabIndex={active?0:-1} onClick={()=>openSheet('comments')}><MessageCircle/></Button><span>Comments</span></div>
 <Button variant="goldOutline" className="shorts-details" aria-label="상세보기 · Product Details" tabIndex={active?0:-1} onClick={()=>openSheet('product')}><ShoppingBag/><span>상세보기</span></Button>
  <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="Share short" tabIndex={active?0:-1} onClick={async()=>{try{if(navigator.share)await navigator.share({title:post.title,url:window.location.href});else{await navigator.clipboard.writeText(window.location.href);notify('Short link copied');}}catch{/* Share dismissed */}}}><Share2/></Button><span>Share</span></div>
 </aside>
 </article>;
}
function ShortSheet({kind,close,children}:{kind:'product'|'comments';close:()=>void;children:React.ReactNode}) {
 const reduced=useReducedMotion();
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Overlay className="shorts-sheet-backdrop"/><Dialog.Content asChild aria-describedby={undefined}><motion.section className="shorts-sheet" initial={{y:reduced?0:'100%'}} animate={{y:0}} exit={{y:reduced?0:'100%'}} transition={{type:'spring',damping:32,stiffness:300}}>
 <motion.div className="shorts-sheet-handle" drag="y" dragConstraints={{top:0,bottom:0}} dragElastic={.4} onDragEnd={(_,info)=>{if(info.offset.y>60||info.velocity.y>500)close();}} aria-label="Drag down to close sheet"><span/></motion.div>
 <header className="shorts-sheet-header"><Dialog.Title>{kind==='product'?'Product Details':'Comments'}</Dialog.Title><Button variant="ghost" size="icon" aria-label="Close Shorts sheet" onClick={close}><X/></Button></header>
 {children}
 </motion.section></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function ProductSummary({post,buy,notify}:{post:LuxuryPost;buy:()=>void;notify:Props['notify']}) {
 const preview=useMarketPreview(),verified=preview.audits[post.id]?preview.audits[post.id]==='Approved':post.verified;
 const location=useRouterState({select:s=>s.location}),search=marketSearch.parse(location.search);
 return <><div className="shorts-sheet-seller"><img src={post.images[0]} alt={post.creator}/><div><strong>@{post.creator.replaceAll(' ','_')}</strong><SellerBadge reputation={post.reputation}/></div><Button asChild variant="goldOutline" size="sm"><Link to="/store" search={{role:search.role,seller:post.sample?undefined:post.source.user_id ?? post.creator,storeTab:'products'}} aria-label="Visit Seller Store">셀러샵<ChevronRight size={14}/></Link></Button></div><div className="shorts-sheet-body"><ShortsGallery key={post.id} images={post.images} title={post.title}/>{post.price!==null&&<p className="lux-price mt-4">{dollars(post.price)}</p>}<h2 className="mt-3 text-lg font-semibold">{post.title}</h2><div className="detail-tags">{verified&&<span>✓ VELA VERIFIED</span>}<span>{post.factory}</span><span>{post.category}</span></div><h3 className="mt-6 text-sm">스펙 정보 · Specifications</h3><dl className="lux-specs">{(post.sample?[
 ['Movement','Dandong VS3235 (72-hour power reserve)'],['Material','904L Stainless Steel'],['Proportion','1:1 Original Specs'],['Water Resistance','50m / 5ATM']
 ]:[['Specifications','Contact seller to confirm']]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="mt-5 text-sm leading-7 text-muted-foreground">{post.description}</p><p className="mt-4 text-xs leading-6 text-primary">#{post.factory.replaceAll(' ','')} #Datejust #Shorts</p><EscrowGuarantee/><SellerRatings reputation={post.reputation}/>{post.sample&&<p className="sample-notice">Studio sample · Specifications, verification and shopping are previews, not live claims.</p>}</div><footer className="shorts-sheet-buy"><Button variant="goldOutline" onClick={()=>{preview.addCart(post);notify('Added to your sample shopping bag');}}>Add to Cart</Button><Button variant="gold" onClick={buy}>Buy Now</Button></footer></>;
}
