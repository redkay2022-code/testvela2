import { ProductDetailContent } from './product-detail-content';
import { EscrowGuarantee } from './escrow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Check, ChevronRight, Heart, MessageCircle, Play, Plus, Search, Share2, Star, Tag, UserRound, Volume2, VolumeX, X } from 'lucide-react';
/** Sound preference shared across swipes; starts muted because browsers block autoplay with sound. */
let shortsSound=false;
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
import { stableMediaSrc } from '@/lib/media-refresh';
import { sellerIdentity } from '@/lib/seller-directory';
import { isHybridPost } from '@/lib/post-media';

const usd=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);
type Props = { posts:LuxuryPost[]; selectedId:string; sheet:'product'|'comments'|undefined; shortTab:'following'|'recommend'; onTab:(tab:'following'|'recommend')=>void; onSearch:()=>void; user:User|null; close:()=>void; closeSheet:()=>void; change:(id:string)=>void; openSheet:(sheet:'product'|'comments')=>void; requestAuth:()=>void; buy:(box?:boolean)=>void; notify:(text:string)=>void };
export function ShortsPlayer({posts:allPosts,selectedId,sheet,shortTab,onTab,onSearch,user,close,closeSheet,change,openSheet,requestAuth,buy,notify}:Props) {
 const preview=useMarketPreview();
 const posts=shortTab==='following'?allPosts.filter(p=>preview.isFollowing(sellerIdentity(p))):allPosts;
 const feed=useRef<HTMLDivElement>(null), activeId=useRef(selectedId), syncing=useRef(true);
 const touch=useRef<{x:number;y:number}|null>(null);
 const [active,setActive]=useState(selectedId);
 const reduced=useReducedMotion();
 const post=posts.find(p=>p.id===active) || posts[0];
 const ids=posts.map(p=>p.id).join('|');
 const mountFeed=useCallback((el:HTMLDivElement|null)=>{feed.current=el;if(!el)return;syncing.current=true;const index=Math.max(0,ids.split('|').indexOf(selectedId));requestAnimationFrame(()=>{el.scrollTo({top:index*el.clientHeight,behavior:'instant'});requestAnimationFrame(()=>{syncing.current=false;});});},[selectedId,ids]);
 useEffect(()=>{syncing.current=true;const index=posts.findIndex(p=>p.id===selectedId);const next=posts[Math.max(0,index)];if(!next)return;activeId.current=next.id;setActive(next.id);feed.current?.scrollTo({top:Math.max(0,index)*(feed.current?.clientHeight || 0),behavior:'instant'});if(next.id!==selectedId)change(next.id);const frame=requestAnimationFrame(()=>{syncing.current=false;});return()=>cancelAnimationFrame(frame);},[selectedId,ids]);
 const share=async()=>{if(!post)return;try{if(navigator.share)await navigator.share({title:post.title,url:window.location.href});else{await navigator.clipboard.writeText(window.location.href);notify('숏폼 링크를 복사했습니다.');}}catch{/* Share dismissed */}};
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Content asChild aria-describedby={undefined}><motion.div className="shorts-player" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onTouchStart={e=>{if(sheet||e.touches.length!==1||(e.target instanceof Element&&e.target.closest('button,a,input,form')))return;const t=e.touches[0];if(t)touch.current={x:t.clientX,y:t.clientY};}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{const start=touch.current;touch.current=null;const end=e.changedTouches[0];if(!sheet&&start&&end){const dx=end.clientX-start.x,dy=end.clientY-start.y;if(dx>80&&dx>Math.abs(dy)*1.5)close();}}}>
 <Dialog.Title className="sr-only">VELA Shorts</Dialog.Title>
 <header className="shorts-floating-header">
 <Button variant="ghost" size="icon" aria-label="Close Shorts and return Home" title="홈으로 돌아가기" onClick={close}><ArrowLeft/></Button>
 <div className="shorts-header-tools"><Button variant="ghost" size="icon" aria-label="Open search" title="검색" onClick={onSearch}><Search/></Button><Button variant="ghost" size="icon" aria-label="Share short" title="공유" onClick={share}><Share2/></Button></div>
 </header>
 <div className={`shorts-snap ${sheet?'shorts-locked':''}`} ref={mountFeed} onScroll={e=>{if(sheet||syncing.current)return;const el=e.currentTarget;const index=Math.round(el.scrollTop/el.clientHeight),next=posts[index];if(next&&Math.abs(el.scrollTop-index*el.clientHeight)<el.clientHeight*.35&&next.id!==activeId.current){activeId.current=next.id;setActive(next.id);change(next.id);}}} tabIndex={0} aria-label="Shorts video feed" onKeyDown={e=>{if(sheet)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();feed.current?.scrollBy({top:(e.key==='ArrowDown'?1:-1)*e.currentTarget.clientHeight,behavior:reduced?'instant':'smooth'});}}}>
 {posts.map(p=><ShortScene key={p.id} post={p} active={p.id===active} openSheet={openSheet} notify={notify} user={user} requestAuth={requestAuth}/>)}
 {!posts.length&&<div className="shorts-follow-empty"><UserRound/><h2>팔로잉한 셀러의 영상이 없습니다.</h2><Button variant="goldOutline" onClick={()=>onTab('recommend')}>추천 영상 보기</Button></div>}
 </div>
 <AnimatePresence>{sheet&&post&&<ShortSheet key={sheet} kind={sheet} close={closeSheet}>
 {sheet==='comments'?<ProductComments postId={post.id} user={user} requestAuth={requestAuth}/>:<ProductDetailContent key={post.id} post={post} user={user} requestAuth={requestAuth} buy={buy} notify={notify} shorts/>}
 </ShortSheet>}</AnimatePresence>
 </motion.div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function ShortScene({post,active,openSheet,notify,user,requestAuth}:{post:LuxuryPost;active:boolean;openSheet:Props['openSheet'];notify:Props['notify'];user:User|null;requestAuth:()=>void}) {
 const hybrid=isHybridPost(post);
 const video=useRef<HTMLVideoElement>(null),preview=useMarketPreview();
 const videoTags=(Array.isArray(post.source?.video_tags)?post.source.video_tags:[]) as {postId:string;title:string;at:number}[];
 const [clock,setClock]=useState(0);
 const [failed,setFailed]=useState(false);const videoSrc=stableMediaSrc(post.video,failed);const [blocked,setBlocked]=useState(false),[liked,setLiked]=useState(false),[sound,setSound]=useState(shortsSound),[ready,setReady]=useState(false);
 const bgm=useRef<HTMLAudioElement>(null),src=post.source as {music_audio_url?:string|null;music_title?:string|null;music_artist?:string|null}|undefined;
 useEffect(()=>{const v=video.current,a=bgm.current;if(!v||!a)return;const sync=()=>{a.muted=v.muted;if(v.paused)a.pause();else{const d=a.duration||1e9;if(Math.abs(a.currentTime-(v.currentTime%d))>0.4)a.currentTime=v.currentTime%d;void a.play().catch(()=>undefined);}};const ev=['play','pause','playing','volumechange','seeked'];ev.forEach(e=>v.addEventListener(e,sync));sync();return()=>{ev.forEach(e=>v.removeEventListener(e,sync));a.pause();};},[active,videoSrc,src?.music_audio_url]);
 useEffect(()=>{const v=video.current;if(!v||!videoTags.length)return;const on=()=>setClock(v.currentTime);v.addEventListener('timeupdate',on);return()=>v.removeEventListener('timeupdate',on);},[videoTags.length]);
 const shownTag=videoTags.find(tg=>clock>=tg.at&&clock<=tg.at+3);
 useEffect(()=>{setFailed(false);},[post.video]);
  const saved=preview.saved.includes(post.id),identity=sellerIdentity(post);
 const following=preview.isFollowing(identity);
 const read=useServerFn(getComments);
 const {data:comments}=useQuery({queryKey:['comments',post.id],queryFn:()=>read({data:{postId:post.id}}),enabled:active});
 useEffect(()=>{const v=video.current;if(!v)return;const want=active&&shortsSound;v.muted=!want;if(active)setSound(want);let cancelled=false;const play=()=>{if(active&&!document.hidden){void v.play().then(()=>{if(!cancelled)setBlocked(false);}).catch(()=>{if(cancelled)return;if(!v.muted){v.muted=true;setSound(false);void v.play().then(()=>{if(!cancelled)setBlocked(false);}).catch(()=>{if(!cancelled)setBlocked(true);});}else setBlocked(true);});}else v.pause();};play();document.addEventListener('visibilitychange',play);return()=>{cancelled=true;v.pause();document.removeEventListener('visibilitychange',play);};},[active,post.video]);
 return <article className="shorts-scene" data-short-id={post.id} aria-label={post.title} aria-hidden={!active} inert={!active}>
 {post.video&&!failed?<><img className={`shorts-video-poster ${active&&ready?'is-hidden':''}`} src={post.images[0]} alt="" aria-hidden="true"/>{active&&<video ref={video} src={videoSrc} playsInline loop muted autoPlay preload="auto" poster={post.images[0]} onLoadedData={()=>setReady(true)} onPlaying={()=>setReady(true)} onError={()=>setFailed(true)}/>}{active&&src?.music_audio_url&&<audio ref={bgm} src={src.music_audio_url} loop preload="auto" muted/>} {active&&!ready&&<div className="shorts-video-loading" aria-label="영상 불러오는 중"><span/></div>}</>:<img src={post.images[0]} alt={post.title}/>} 
 <div className="shorts-shade"/>
 {post.video&&!failed&&<button type="button" className="shorts-sound-toggle" aria-label={sound?'소리 끄기':'소리 켜기'} aria-pressed={sound} onClick={()=>{const v=video.current;if(!v)return;const next=!sound;shortsSound=next;v.muted=!next;setSound(next);if(next)void v.play().catch(()=>undefined);}}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}{!sound&&<span>소리 켜기</span>}</button>}
 {(blocked||failed||!post.video)&&<div className="shorts-media-state">{blocked&&!failed?<Button variant="ghost" aria-label="Play video" onClick={()=>{void video.current?.play().then(()=>setBlocked(false)).catch(()=>notify('이 기기에서 영상을 재생할 수 없습니다.'));}}><Play/> 재생</Button>:<span>{failed?'영상을 불러올 수 없습니다.':'미리보기 이미지'}</span>}</div>}
 {hybrid&&shownTag&&<Link to="/post/$id" params={{id:shownTag.postId}} className="shorts-video-tag" data-no-translate><Tag size={13}/>{shownTag.title}</Link>}
 <div className="shorts-product-overlay">
 {hybrid?<><div className="shorts-tier-line"><SellerBadge reputation={post.reputation} withRating/></div>
 <div className="shorts-seller-row">
 <div className="shorts-seller-identity"><Link to="/store" search={{seller:identity}} className="shorts-seller-link" data-no-translate><span className="shorts-anonymous-avatar"><UserRound/></span><strong>{post.creator}</strong></Link><Button variant="goldOutline" className="shorts-follow-button" aria-label={following?'Unfollow creator':'Follow creator'} aria-pressed={following} onClick={()=>preview.toggleSeller(identity)}>{following?<Check size={13}/>:<Plus size={13}/>} {following?'팔로잉':'팔로우'}</Button></div>
 <Button asChild variant="gold" className="shorts-view-details"><Link to="/post/$id" params={{id:post.id}} aria-label="상세 보기">상세 보기<ChevronRight size={17}/></Link></Button>
 </div>
 </div>
 <footer className="shorts-bottom-bar">
 {active&&<ProductComments key={post.id} postId={post.id} user={user} requestAuth={requestAuth} composerOnly/>}
 <aside className="shorts-bottom-actions" aria-label="Shorts actions">
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="좋아요" title="좋아요" aria-pressed={liked} className={liked?'shorts-liked':''} onClick={()=>setLiked(value=>!value)}><motion.span key={String(liked)} animate={{scale:liked?[1,1.25,1]:1}}><Heart fill={liked?'currentColor':'none'}/></motion.span></Button><span>{post.likes+(liked?1:0)}</span></div>
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="저장" title="저장" aria-pressed={saved} className={saved?'shorts-liked':''} onClick={()=>preview.toggleSaved(post.id)}><Star fill={saved?'currentColor':'none'}/></Button><span>{saved?1:0}</span></div>
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="댓글" title="댓글" onClick={()=>openSheet('comments')}><MessageCircle/></Button><span>{comments?.length ?? '—'}</span></div>
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
