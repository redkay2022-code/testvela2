import { EscrowGuarantee } from './escrow';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Check, ChevronRight, Heart, MessageCircle, Play, Plus, Search, Share2, ShoppingBag, Star, UserRound, X } from 'lucide-react';
import { Link, useRouterState } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { ProductComments } from './product-comments';
import { useMarketPreview } from './market-preview';
import { type LuxuryPost } from '@/lib/luxury-market';
import { SellerBadge, SellerRatings } from './reputation';
import { ShortsGallery } from './shorts-gallery';
import { SpecsTable } from './specs-table';
import { marketSearch } from '@/lib/market';
import { getComments } from '@/lib/market.functions';
import { sellerIdentity } from '@/lib/seller-directory';

const usd=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);
type Props = { posts:LuxuryPost[]; selectedId:string; sheet:'product'|'comments'|undefined; shortTab:'following'|'recommend'; onTab:(tab:'following'|'recommend')=>void; onSearch:()=>void; user:User|null; close:()=>void; closeSheet:()=>void; change:(id:string)=>void; openSheet:(sheet:'product'|'comments')=>void; requestAuth:()=>void; buy:()=>void; notify:(text:string)=>void };
export function ShortsPlayer({posts:allPosts,selectedId,sheet,shortTab,onTab,onSearch,user,close,closeSheet,change,openSheet,requestAuth,buy,notify}:Props) {
 const preview=useMarketPreview();
 const posts=shortTab==='following'?allPosts.filter(p=>preview.followedSellers.includes(sellerIdentity(p))||(p.sample&&preview.following)):allPosts;
 const feed=useRef<HTMLDivElement>(null), activeId=useRef(selectedId), syncing=useRef(true);
 const touch=useRef<{x:number;y:number}|null>(null);
 const [active,setActive]=useState(selectedId);
 const reduced=useReducedMotion();
 const post=posts.find(p=>p.id===active) || posts[0];
 const ids=posts.map(p=>p.id).join('|');
 useEffect(()=>{syncing.current=true;const index=posts.findIndex(p=>p.id===selectedId);const next=posts[Math.max(0,index)];if(!next)return;activeId.current=next.id;setActive(next.id);feed.current?.scrollTo({top:Math.max(0,index)*(feed.current?.clientHeight || 0),behavior:'instant'});if(next.id!==selectedId)change(next.id);const frame=requestAnimationFrame(()=>{syncing.current=false;});return()=>cancelAnimationFrame(frame);},[selectedId,ids]);
 const share=async()=>{if(!post)return;try{if(navigator.share)await navigator.share({title:post.title,url:window.location.href});else{await navigator.clipboard.writeText(window.location.href);notify('숏폼 링크를 복사했습니다.');}}catch{/* Share dismissed */}};
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Content asChild aria-describedby={undefined}><motion.div className="shorts-player" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onTouchStart={e=>{if(sheet||e.touches.length!==1||(e.target instanceof Element&&e.target.closest('button,a,input,form')))return;const t=e.touches[0];if(t)touch.current={x:t.clientX,y:t.clientY};}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{const start=touch.current;touch.current=null;const end=e.changedTouches[0];if(!sheet&&start&&end){const dx=end.clientX-start.x,dy=end.clientY-start.y;if(dx>80&&dx>Math.abs(dy)*1.5)close();}}}>
 <Dialog.Title className="sr-only">VELA Shorts</Dialog.Title>
 <header className="shorts-floating-header">
 <Button variant="ghost" size="icon" aria-label="Close Shorts and return Home" title="홈으로 돌아가기" onClick={close}><ArrowLeft/></Button>
 <nav className="shorts-feed-tabs" aria-label="숏폼 피드 선택">{([['following','팔로잉'],['recommend','추천']] as const).map(([tab,label])=><Button key={tab} variant="ghost" aria-pressed={shortTab===tab} onClick={()=>onTab(tab)}>{label}</Button>)}</nav>
 <div className="shorts-header-tools"><Button variant="ghost" size="icon" aria-label="Open search" title="검색" onClick={onSearch}><Search/></Button><Button variant="ghost" size="icon" aria-label="Share short" title="공유" onClick={share}><Share2/></Button></div>
 </header>
 <div className={`shorts-snap ${sheet?'shorts-locked':''}`} ref={feed} onScroll={e=>{if(sheet||syncing.current)return;const el=e.currentTarget;const index=Math.round(el.scrollTop/el.clientHeight),next=posts[index];if(next&&Math.abs(el.scrollTop-index*el.clientHeight)<el.clientHeight*.35&&next.id!==activeId.current){activeId.current=next.id;setActive(next.id);change(next.id);}}} tabIndex={0} aria-label="Shorts video feed" onKeyDown={e=>{if(sheet)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();feed.current?.scrollBy({top:(e.key==='ArrowDown'?1:-1)*e.currentTarget.clientHeight,behavior:reduced?'instant':'smooth'});}}}>
 {posts.map(p=><ShortScene key={p.id} post={p} active={p.id===active} openSheet={openSheet} notify={notify} user={user} requestAuth={requestAuth} buy={buy}/>)}
 {!posts.length&&<div className="shorts-follow-empty"><UserRound/><h2>팔로잉한 셀러의 영상이 없습니다.</h2><Button variant="goldOutline" onClick={()=>onTab('recommend')}>추천 영상 보기</Button></div>}
 </div>
 <AnimatePresence>{sheet&&post&&<ShortSheet key={sheet} kind={sheet} close={closeSheet}>
 {sheet==='comments'?<ProductComments postId={post.id} user={user} requestAuth={requestAuth}/>:<ProductSummary post={post} buy={buy} notify={notify}/>}
 </ShortSheet>}</AnimatePresence>
 </motion.div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function ShortScene({post,active,openSheet,notify,user,requestAuth,buy}:{post:LuxuryPost;active:boolean;openSheet:Props['openSheet'];notify:Props['notify'];user:User|null;requestAuth:()=>void;buy:()=>void}) {
 const video=useRef<HTMLVideoElement>(null),preview=useMarketPreview();
 const [failed,setFailed]=useState(false),[blocked,setBlocked]=useState(false),[liked,setLiked]=useState(false);
 const saved=preview.saved.includes(post.id),identity=sellerIdentity(post);
 const following=post.sample?preview.following:preview.followedSellers.includes(identity);
 const read=useServerFn(getComments);
 const {data:comments}=useQuery({queryKey:['comments',post.id],queryFn:()=>read({data:{postId:post.id}}),enabled:active});
 useEffect(()=>{const v=video.current;if(!v)return;v.muted=true;let cancelled=false;const play=()=>{if(active&&!document.hidden){void v.play().then(()=>{if(!cancelled)setBlocked(false);}).catch(()=>{if(!cancelled)setBlocked(true);});}else v.pause();};play();document.addEventListener('visibilitychange',play);return()=>{cancelled=true;v.pause();document.removeEventListener('visibilitychange',play);};},[active,post.video]);
 return <article className="shorts-scene" data-short-id={post.id} aria-label={post.title} aria-hidden={!active} inert={!active}>
 {post.video&&!failed?<video ref={video} playsInline loop muted preload={active?'auto':'none'} onError={()=>setFailed(true)}><source src={post.video} type={post.videoFallback?'video/webm':undefined}/>{post.videoFallback&&<source src={post.videoFallback} type="video/mp4"/>}</video>:<img src={post.images[0]} alt={post.title}/>}
 <div className="shorts-shade"/>
 {(blocked||failed||!post.video)&&<div className="shorts-media-state">{blocked&&!failed?<Button variant="ghost" aria-label="Play video" onClick={()=>{void video.current?.play().then(()=>setBlocked(false)).catch(()=>notify('이 기기에서 영상을 재생할 수 없습니다.'));}}><Play/> 재생</Button>:<span>{failed?'영상을 불러올 수 없습니다.':'미리보기 이미지'}</span>}</div>}
 <div className="shorts-product-overlay">
 <div className="shorts-seller-row"><Link to="/store" search={{seller:identity}} className="shorts-seller-link" data-no-translate><span className="shorts-anonymous-avatar"><UserRound/></span><strong>{post.creator}</strong></Link><Button variant="goldOutline" className="shorts-follow-button" aria-label={following?'Unfollow creator':'Follow creator'} aria-pressed={following} onClick={()=>preview.toggleSeller(identity)}>{following?<Check size={13}/>:<Plus size={13}/>} {following?'팔로잉':'팔로우'}</Button></div>
 <div className="shorts-title-row"><span className="shorts-category-badge">{post.category}</span><h2>{post.title}</h2></div>
 <div className="shorts-product-description"><p>{post.description}</p><Button variant="ghost" onClick={()=>openSheet('product')} aria-label="펼쳐 보기 · Product Details">펼쳐 보기<ChevronRight size={13}/></Button></div>
 {post.price!==null&&<div className="shorts-purchase-row"><span className="shorts-usd-price" data-no-translate><small>USD</small>{usd(post.price)}</span><Button variant="gold" onClick={buy}><ShoppingBag size={15}/>구매 / 에스크로 주문</Button></div>}
 </div>
 <footer className="shorts-bottom-bar">
 {active&&<ProductComments key={post.id} postId={post.id} user={user} requestAuth={requestAuth} composerOnly/>}
 <aside className="shorts-bottom-actions" aria-label="Shorts actions">
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="Like short" title="좋아요" aria-pressed={liked} className={liked?'shorts-liked':''} onClick={()=>setLiked(value=>!value)}><motion.span key={String(liked)} animate={{scale:liked?[1,1.25,1]:1}}><Heart fill={liked?'currentColor':'none'}/></motion.span></Button><span>{post.likes+(liked?1:0)}</span></div>
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="Bookmark short" title="즐겨찾기" aria-pressed={saved} className={saved?'shorts-liked':''} onClick={()=>preview.toggleSaved(post.id)}><Star fill={saved?'currentColor':'none'}/></Button><span>{saved?1:0}</span></div>
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="Open Shorts comments" title="댓글" onClick={()=>openSheet('comments')}><MessageCircle/></Button><span>{comments?.length ?? '—'}</span></div>
 </aside>
 </footer>
 </article>;
}
function ShortSheet({kind,close,children}:{kind:'product'|'comments';close:()=>void;children:React.ReactNode}) {
 const reduced=useReducedMotion();
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Overlay className="shorts-sheet-backdrop"/><Dialog.Content asChild aria-describedby={undefined}><motion.section className="shorts-sheet" initial={{y:reduced?0:'100%'}} animate={{y:0}} exit={{y:reduced?0:'100%'}} transition={{type:'spring',damping:32,stiffness:300}}>
 <motion.div className="shorts-sheet-handle" drag="y" dragConstraints={{top:0,bottom:0}} dragElastic={.4} onDragEnd={(_,info)=>{if(info.offset.y>60||info.velocity.y>500)close();}} aria-label="Drag down to close sheet"><span/></motion.div>
 <header className="shorts-sheet-header"><Dialog.Title>{kind==='product'?'제품 상세':'댓글'}</Dialog.Title><Button variant="ghost" size="icon" aria-label="Close Shorts sheet" onClick={close}><X/></Button></header>
 {children}
 </motion.section></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function ProductSummary({post,buy,notify}:{post:LuxuryPost;buy:()=>void;notify:Props['notify']}) {
 const preview=useMarketPreview(),verified=preview.audits[post.id]?preview.audits[post.id]==='Approved':post.verified;
 const location=useRouterState({select:s=>s.location}),search=marketSearch.parse(location.search);
 return <><div className="shorts-sheet-seller" data-no-translate><span className="shorts-anonymous-avatar"><UserRound/></span><div><strong>{post.creator}</strong><SellerBadge reputation={post.reputation}/></div><Button asChild variant="goldOutline" size="sm"><Link to="/store" search={{role:search.role,seller:sellerIdentity(post),storeTab:'products'}} aria-label="Visit Seller Store">셀러샵<ChevronRight size={14}/></Link></Button></div><div className="shorts-sheet-body"><ShortsGallery key={post.id} images={post.images} title={post.title}/>{post.price!==null&&<p className="lux-price mt-4" data-no-translate>{usd(post.price)} <small>USD</small></p>}<h2 className="mt-3 text-lg font-semibold">{post.title}</h2><div className="detail-tags">{verified&&<span>✓ VELA VERIFIED</span>}<span>{post.category}</span></div><SpecsTable specs={post.source.specs} fallback={post.sample?<><h3 className="mt-6 text-sm">상품 사양 · 샘플</h3><dl className="lux-specs">{[['무브먼트','Dandong VS3235 (72-hour power reserve)'],['케이스 소재','904L Stainless Steel'],['방수','50m / 5ATM']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>:<p className="mt-5 text-sm text-muted-foreground">등록된 사양이 없습니다.</p>}/><p className="mt-5 text-sm leading-7 text-muted-foreground">{post.description}</p>{post.price!==null&&<EscrowGuarantee/>}<SellerRatings reputation={post.reputation}/>{post.sample&&<p className="sample-notice">샘플 상품 · 사양, 검증 및 구매는 미리보기입니다.</p>}</div>{post.price!==null&&<footer className="shorts-sheet-buy"><Button variant="goldOutline" onClick={()=>{preview.addCart(post);notify('미리보기 장바구니에 담았습니다.');}}>장바구니 담기</Button><Button variant="gold" onClick={buy}>구매 / 에스크로 주문</Button></footer>}</>;
}
