import { ProductDetailContent } from './product-detail-content';
import './shorts-nav.css';
import { tx } from '@/lib/dom-translate';
import { avatarKey, defaultAvatarUrl } from '@/lib/default-avatar';
import { EscrowGuarantee } from './escrow';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Check, ChevronDown, ChevronRight, ChevronUp, Heart, MessageCircle, Play, Plus, Search, Share2, Star, Tag, UserRound, Volume2, VolumeX, X } from 'lucide-react';
/* NOTE: this code only controls video loading/playback. It cannot compress raw video files; compression happens at upload time (video-compress.ts) or on a video CDN. */
/** Sound preference shared across swipes; starts muted because browsers block autoplay with sound. */
let shortsSound=false;
import { Link, useRouterState } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { ProductComments } from './product-comments';
import { useMarketPreview } from './market-preview';
import { type LuxuryPost } from '@/lib/luxury-market';
import { SellerBadge, SellerRatings } from './reputation';
import { ShortsGallery } from './shorts-gallery';
import { marketSearch } from '@/lib/market';
import { getComments } from '@/lib/market.functions';
import { loadSellerAvatar } from '@/lib/seller-avatar';
import { stableMediaSrc } from '@/lib/media-refresh';
import { attachHls, isHlsUrl, warmHls } from '@/lib/hls-loader';
import { isMuxStreamUrl, muxThumbnailUrl } from '@/lib/mux';
import { sellerIdentity } from '@/lib/seller-directory';
import { useEngagement } from '@/lib/use-engagement';
import { isHybridPost } from '@/lib/post-media';
import { TEST_COUNTS_ENABLED, likeAdj, shownPostLikes, testPostSaves } from '@/lib/test-counts';

type Props = { posts:LuxuryPost[]; selectedId:string; sheet:'product'|'comments'|undefined; shortTab:'following'|'recommend'; onTab:(tab:'following'|'recommend')=>void; onSearch:()=>void; user:User|null; close:()=>void; closeSheet:()=>void; change:(id:string)=>void; openSheet:(sheet:'product'|'comments')=>void; requestAuth:()=>void; buy:(box?:boolean,insured?:boolean)=>void; notify:(text:string)=>void };
export function ShortsPlayer({posts:allPosts,selectedId,sheet,shortTab,onTab,onSearch,user,close,closeSheet,change,openSheet,requestAuth,buy,notify}:Props) {
 const preview=useMarketPreview();
 const posts=shortTab==='following'?allPosts.filter(p=>preview.isFollowing(sellerIdentity(p))):allPosts;
 const feed=useRef<HTMLDivElement>(null), activeId=useRef(selectedId), syncing=useRef(true);
 const touch=useRef<{x:number;y:number}|null>(null);
 const [active,setActive]=useState(selectedId);
 const reduced=useReducedMotion();
 const post=posts.find(p=>p.id===active) || posts[0];
 const ids=posts.map(p=>p.id).join('|');
 const activeIdx=Math.max(0,posts.findIndex(x=>x.id===active));
 const mountFeed=useCallback((el:HTMLDivElement|null)=>{feed.current=el;if(!el)return;syncing.current=true;const index=Math.max(0,ids.split('|').indexOf(selectedId));requestAnimationFrame(()=>{el.scrollTo({top:index*el.clientHeight,behavior:'instant'});requestAnimationFrame(()=>{syncing.current=false;});});},[selectedId,ids]);
 useEffect(()=>{syncing.current=true;const index=posts.findIndex(p=>p.id===selectedId);const next=posts[Math.max(0,index)];if(!next)return;activeId.current=next.id;setActive(next.id);feed.current?.scrollTo({top:Math.max(0,index)*(feed.current?.clientHeight || 0),behavior:'instant'});if(next.id!==selectedId)change(next.id);const frame=requestAnimationFrame(()=>{syncing.current=false;});return()=>cancelAnimationFrame(frame);},[selectedId,ids]);
 /* 컴퓨터: 방향키/PageUp·PageDown/화면의 위·아래 버튼으로 이전·다음 영상으로 이동 (휠 스크롤은 기본 지원) */
 const goTo=(delta:number)=>{const el=feed.current;if(!el||sheet)return;const index=Math.min(posts.length-1,Math.max(0,activeIdx+delta));el.scrollTo({top:index*el.clientHeight,behavior:'smooth'});};
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(sheet||e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey)return;const t=e.target;if(t instanceof HTMLElement&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;if(e.key==='ArrowDown'||e.key==='PageDown'){e.preventDefault();goTo(1);}else if(e.key==='ArrowUp'||e.key==='PageUp'){e.preventDefault();goTo(-1);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);});
 const share=async()=>{if(!post)return;try{if(navigator.share)await navigator.share({title:post.title,url:window.location.href});else{await navigator.clipboard.writeText(window.location.href);notify('숏폼 링크를 복사했습니다.');}}catch{/* Share dismissed */}};
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Content asChild aria-describedby={undefined}><motion.div className="shorts-player" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onTouchStart={e=>{if(sheet||e.touches.length!==1||(e.target instanceof Element&&e.target.closest('button,a,input,form')))return;const t=e.touches[0];if(t)touch.current={x:t.clientX,y:t.clientY};}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{const start=touch.current;touch.current=null;const end=e.changedTouches[0];if(!sheet&&start&&end){const dx=end.clientX-start.x,dy=end.clientY-start.y;if(dx>80&&dx>Math.abs(dy)*1.5)close();}}}>
 <Dialog.Title className="sr-only">VELA Shorts</Dialog.Title>
 <header className="shorts-floating-header">
 <Button variant="ghost" size="icon" aria-label="Close Shorts and return Home" title="홈으로 돌아가기" onClick={close}><ArrowLeft/></Button>
 <div className="shorts-header-tools"><Button variant="ghost" size="icon" aria-label="Open search" title="검색" onClick={onSearch}><Search/></Button><Button variant="ghost" size="icon" aria-label="Share short" title="공유" onClick={share}><Share2/></Button></div>
 </header>
 {posts.length>1&&!sheet&&<div className="shorts-nav-arrows"><Button variant="ghost" size="icon" aria-label={tx('이전 영상')} title={tx('이전 영상')} disabled={activeIdx<=0} onClick={()=>goTo(-1)}><ChevronUp/></Button><Button variant="ghost" size="icon" aria-label={tx('다음 영상')} title={tx('다음 영상')} disabled={activeIdx>=posts.length-1} onClick={()=>goTo(1)}><ChevronDown/></Button></div>}
 <div className={`shorts-snap ${sheet?'shorts-locked':''}`} ref={mountFeed} onScroll={e=>{if(sheet||syncing.current)return;const el=e.currentTarget;const index=Math.round(el.scrollTop/el.clientHeight),next=posts[index];if(next&&Math.abs(el.scrollTop-index*el.clientHeight)<el.clientHeight*.35&&next.id!==activeId.current){activeId.current=next.id;setActive(next.id);change(next.id);}}} tabIndex={0} aria-label="Shorts video feed" onKeyDown={e=>{if(sheet)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();feed.current?.scrollBy({top:(e.key==='ArrowDown'?1:-1)*e.currentTarget.clientHeight,behavior:reduced?'instant':'smooth'});}}}>
 {/* Only the scenes around the current one are real (poster, video, seller data). Far-away scenes are empty boxes of the
     same height, so opening Shorts no longer downloads hundreds of posters that compete with the first video. */}
 {posts.map((p,i)=>{const dist=Math.abs(i-activeIdx);return dist<=2?<ShortScene key={p.id} post={p} active={p.id===active} dist={dist} ahead={i>activeIdx} openSheet={openSheet} notify={notify} user={user} requestAuth={requestAuth}/>:<article key={p.id} className="shorts-scene" data-short-id={p.id} aria-hidden="true" inert/>;})}
 {!posts.length&&<div className="shorts-follow-empty"><UserRound/><h2>팔로잉한 셀러의 영상이 없습니다.</h2><Button variant="goldOutline" onClick={()=>onTab('recommend')}>추천 영상 보기</Button></div>}
 </div>
 <AnimatePresence>{sheet&&post&&<ShortSheet key={sheet} kind={sheet} close={closeSheet}>
  {sheet==='comments'?<ProductComments postId={post.id} user={user} requestAuth={requestAuth}/>:<ProductDetailContent key={post.id} post={post} user={user} requestAuth={requestAuth} buy={buy} notify={notify} shorts/>}
 </ShortSheet>}</AnimatePresence>
 </motion.div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
/* Memoised so scenes that did not change (other videos) are not re-rendered while the feed scrolls. */
const ShortScene=memo(function ShortScene({post,active,dist,ahead,openSheet,notify,user,requestAuth}:{post:LuxuryPost;active:boolean;dist:number;ahead:boolean;openSheet:Props['openSheet'];notify:Props['notify'];user:User|null;requestAuth:()=>void}) {
 const hybrid=isHybridPost(post);const engagement=useEngagement(),liked=engagement.likedIds.has(post.id);
 const video=useRef<HTMLVideoElement>(null),preview=useMarketPreview();
 const videoTags=(Array.isArray(post.source?.video_tags)?post.source.video_tags:[]) as {postId:string;title:string;at:number}[];
 const [clock,setClock]=useState(0);
 // Only the visible video and its two neighbours exist as <video> elements (phones choke on more). The neighbours start their full download a moment after the visible video so they never slow it down.
 const [warm,setWarm]=useState(false);
 useEffect(()=>{if(active||dist!==1){setWarm(false);return;}/* Data-saver mode: no background downloads. The next video (swipe direction) starts at once, the previous one a little later. */const saver=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData;if(saver){setWarm(false);return;}const t=window.setTimeout(()=>setWarm(true),ahead?60:700);return()=>window.clearTimeout(t);},[active,dist,ahead]);
 const [failed,setFailed]=useState(false);const videoSrc=stableMediaSrc(post.video,failed);const [blocked,setBlocked]=useState(false),[sound,setSound]=useState(shortsSound),[ready,setReady]=useState(false);
 const hlsMode=isHlsUrl(videoSrc);/* Mux videos use Mux's small poster (image CDN) instead of the full-size product photo. */const poster=isMuxStreamUrl(post.video)?muxThumbnailUrl(post.video,1080):post.images[0];useEffect(()=>{if(hlsMode&&dist<=1)warmHls();},[hlsMode,dist]);const [buf,setBuf]=useState<{wait:boolean;pct:number}>({wait:false,pct:0});
 /* HLS: the visible video AND the next one (swipe direction) own a stream. The next one only buffers its first few seconds
    (lowest quality first), so a swipe starts playing at once. The same stream is kept when it becomes the visible video;
    anything further away is destroyed (no background download). Data-saver mode skips the warm-up (warm stays false). */
 const streamOn=active||(dist===1&&ahead&&warm);
 useEffect(()=>{const v=video.current;if(failed||!hlsMode||!streamOn||!v||!videoSrc)return;const stop=attachHls(v,videoSrc,{onFatal:()=>setFailed(true)});return stop;},[hlsMode,streamOn,videoSrc,failed]);
 /* Buffer indicator: a thin bar fills while the video waits for data. */
 useEffect(()=>{const v=video.current;if(!v||!active)return;const wait=()=>setBuf(b=>b.wait?b:{...b,wait:true});const done=()=>setBuf(b=>b.wait?{...b,wait:false}:b);const prog=()=>{const n=v.buffered.length;const end=n?v.buffered.end(n-1):0;const pct=v.duration?Math.min(100,Math.round(((end-v.currentTime)/Math.max(3,Math.min(v.duration,8)))*100)):0;setBuf(b=>Math.abs(b.pct-pct)>=5?{...b,pct}:b);};const on:[string,()=>void][]=[['waiting',wait],['stalled',wait],['playing',done],['canplay',done],['progress',prog]];on.forEach(([e,f])=>v.addEventListener(e,f));return()=>on.forEach(([e,f])=>v.removeEventListener(e,f));},[active,videoSrc]);
 const bgm=useRef<HTMLAudioElement>(null),src=post.source as {music_audio_url?:string|null;music_title?:string|null;music_artist?:string|null}|undefined;
 useEffect(()=>{const v=video.current,a=bgm.current;if(!v||!a)return;const sync=()=>{a.muted=v.muted;if(v.paused)a.pause();else{const d=a.duration||1e9;if(Math.abs(a.currentTime-(v.currentTime%d))>0.4)a.currentTime=v.currentTime%d;void a.play().catch(()=>undefined);}};const ev=['play','pause','playing','volumechange','seeked'];ev.forEach(e=>v.addEventListener(e,sync));sync();return()=>{ev.forEach(e=>v.removeEventListener(e,sync));a.pause();};},[active,videoSrc,src?.music_audio_url]);
 useEffect(()=>{const v=video.current;if(!v||!videoTags.length)return;const on=()=>setClock(v.currentTime);v.addEventListener('timeupdate',on);return()=>v.removeEventListener('timeupdate',on);},[videoTags.length]);
 const shownTag=videoTags.find(tg=>clock>=tg.at&&clock<=tg.at+3);
 useEffect(()=>{setFailed(false);},[post.video]);
  const saved=preview.saved.includes(post.id),identity=sellerIdentity(post);
 const read=useServerFn(getComments);
  const {data:comments}=useQuery({queryKey:['comments',post.id,'comment',user?.id ?? 'public'],queryFn:()=>read({data:{postId:post.id,kind:'comment'}}),enabled:active});
 useEffect(()=>{const v=video.current;if(!v)return;
  if(!active){v.pause();/* Rewind only after the swipe has finished: rewinding at once made the old video jump to its first frame while still half on screen. */const t=window.setTimeout(()=>{try{v.currentTime=0;}catch{/* not seekable yet */}setReady(false);},500);return()=>window.clearTimeout(t);}
  const want=shortsSound;v.muted=!want;setSound(want);let cancelled=false;
  const play=()=>{if(cancelled||document.hidden||!v.isConnected)return;
   void v.play().then(()=>{if(!cancelled)setBlocked(false);}).catch((err:unknown)=>{if(cancelled)return;
    const name=err instanceof DOMException?err.name:'';
    if(name==='NotAllowedError'){if(!v.muted){v.muted=true;setSound(false);play();}else setBlocked(true);}
    /* AbortError / not loaded yet: retry as soon as the data is ready */
    else{v.addEventListener('canplay',play,{once:true});}});};
  const onVis=()=>{if(document.hidden)v.pause();else play();};
  play();v.addEventListener('loadeddata',play,{once:true});document.addEventListener('visibilitychange',onVis);
  return()=>{cancelled=true;v.removeEventListener('loadeddata',play);v.removeEventListener('canplay',play);document.removeEventListener('visibilitychange',onVis);};},[active,post.video,videoSrc]);
 return <article className="shorts-scene" data-short-id={post.id} aria-label={post.title} aria-hidden={!active} inert={!active}>
 {post.video&&!failed?<><img className={`shorts-video-poster ${ready?'is-hidden':''}`} src={poster} alt="" aria-hidden="true" decoding="async" fetchPriority={active?'high':'low'}/>{dist<=1&&<video ref={video} src={hlsMode?undefined:videoSrc} style={{background:'#000',willChange:'transform'}} playsInline loop muted autoPlay={active} preload={active||(dist===1&&warm)?'auto':'none'} poster={poster} onLoadedData={e=>{setReady(true);const el=e.currentTarget;/* Neighbours: decode and paint the first frame now so the swipe shows picture instantly. */if(!active&&el.currentTime===0){try{el.currentTime=0.001;}catch{/* not seekable yet */}}}} onPlaying={()=>setReady(true)} onError={()=>{/* HLS: hls.js recovers decoder/network errors itself and reports real failures via onFatal. */if(!hlsMode)setFailed(true);}} onClick={()=>{if(!active)return;const v=video.current;if(!v)return;const next=!shortsSound;shortsSound=next;v.muted=!next;setSound(next);if(next)void v.play().catch(()=>undefined);}}/>}{active&&src?.music_audio_url&&<audio ref={bgm} src={src.music_audio_url} loop preload="auto" muted/>} {active&&ready&&buf.wait&&<div className="shorts-buffer" role="progressbar" aria-label="Buffering" aria-valuenow={buf.pct} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${Math.max(8,buf.pct)}%`}}/></div>}{active&&(!ready||buf.wait)&&<div className="shorts-video-loading" aria-label="영상 불러오는 중"><span/></div>}</>:<img src={post.images[0]} alt={post.title}/>} 
 <div className="shorts-shade"/>
 {post.video&&!failed&&<button type="button" className="shorts-sound-toggle" aria-label={sound?'소리 끄기':'소리 켜기'} aria-pressed={sound} onClick={()=>{const v=video.current;if(!v)return;const next=!sound;shortsSound=next;v.muted=!next;setSound(next);if(next)void v.play().catch(()=>undefined);}}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}{!sound&&<span>소리 켜기</span>}</button>}
 {(blocked||failed||!post.video)&&<div className="shorts-media-state">{blocked&&!failed?<Button variant="ghost" aria-label="Play video" onClick={()=>{void video.current?.play().then(()=>setBlocked(false)).catch(()=>notify('이 기기에서 영상을 재생할 수 없습니다.'));}}><Play/> 재생</Button>:failed?<Button variant="ghost" aria-label="Retry video" onClick={()=>{setReady(false);setFailed(false);}}><Play/> 다시 시도</Button>:<span>미리보기 이미지</span>}</div>}
 {hybrid&&shownTag&&<Link to="/post/$id" params={{id:shownTag.postId}} className="shorts-video-tag" data-no-translate><Tag size={13}/>{shownTag.title}</Link>}
 <div className="shorts-product-overlay">
  <div className="shorts-tier-line"><SellerBadge reputation={post.reputation} withRating/></div>
 <div className="shorts-seller-row">
  <ShortSellerIdentity post={post}/>
  {post.menuCategory!=='스토리'&&<Button asChild variant="gold" className="shorts-view-details"><Link to="/post/$id" params={{id:post.id}} aria-label="상세 보기">상세 보기<ChevronRight size={17}/></Link></Button>}
 </div>
 </div>
 <footer className="shorts-bottom-bar">
 {active&&<ProductComments key={post.id} postId={post.id} user={user} requestAuth={requestAuth} composerOnly/>}
 <aside className="shorts-bottom-actions" aria-label="Shorts actions">
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="좋아요" title="좋아요" aria-pressed={liked} className={liked?'shorts-liked':''} onClick={()=>{if(!user){requestAuth();return;}engagement.toggleLike(post.id);}}><motion.span key={String(liked)} animate={{scale:liked?[1,1.25,1]:1}}><Heart fill={liked?'currentColor':'none'}/></motion.span></Button><span>{shownPostLikes(post.id,post.likes)+likeAdj(liked)}</span></div>
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="저장" title="저장" aria-pressed={saved} className={saved?'shorts-liked':''} onClick={()=>preview.toggleSaved(post.id)}><Star fill={saved?'currentColor':'none'}/></Button><span>{(TEST_COUNTS_ENABLED?testPostSaves(post.id):0)+likeAdj(saved)}</span></div>
 <div className="shorts-action"><Button variant="ghost" size="icon" aria-label="댓글" title="댓글" onClick={()=>openSheet('comments')}><MessageCircle/></Button><span>{comments?.length ?? '—'}</span></div>
 </aside>
 </footer>
 </article>;
});
function ShortSellerIdentity({post}:{post:LuxuryPost}) {
 const preview=useMarketPreview(),identity=sellerIdentity(post),following=preview.isFollowing(identity);
 const sellerAvatar=useQuery({queryKey:['seller-header-avatar',post.source.store_id ?? post.source.user_id ?? null],enabled:!post.sample&&Boolean(post.source.store_id||post.source.user_id),queryFn:()=>loadSellerAvatar({data:{storeId:post.source.store_id ?? undefined,userId:post.source.user_id ?? undefined}}),staleTime:300_000});
 return <div className="shorts-seller-identity"><Link to="/store" search={{seller:identity}} className="shorts-seller-link" data-no-translate><Avatar className="shorts-anonymous-avatar"><AvatarImage src={sellerAvatar.data?.avatar ?? (sellerAvatar.isLoading ? undefined : defaultAvatarUrl(avatarKey(post.source.user_id ?? post.source.store_id ?? post.creator), post.creator))} alt={`${post.creator} 프로필 사진`} className="object-cover"/><AvatarFallback className="bg-transparent" aria-label="판매자 프로필"><UserRound/></AvatarFallback></Avatar><strong data-i18n-skip className="notranslate" translate="no">{post.creator}</strong></Link><Button variant="goldOutline" className="shorts-follow-button" aria-label={following?'팔로우 취소':'팔로우'} aria-pressed={following} onClick={()=>preview.toggleSeller(identity)}>{following?<Check size={13}/>:<Plus size={13}/>} {following?'팔로잉':'팔로우'}</Button></div>;
}
function ShortSheet({kind,close,children}:{kind:'product'|'comments';close:()=>void;children:React.ReactNode}) {
 const reduced=useReducedMotion();
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Overlay className="shorts-sheet-backdrop"/><Dialog.Content asChild aria-describedby={undefined}><motion.section className="shorts-sheet" initial={{y:reduced?0:'100%'}} animate={{y:0}} exit={{y:reduced?0:'100%'}} transition={{type:'spring',damping:32,stiffness:300}}>
 <motion.div className="shorts-sheet-handle" drag="y" dragConstraints={{top:0,bottom:0}} dragElastic={.4} onDragEnd={(_,info)=>{if(info.offset.y>60||info.velocity.y>500)close();}} aria-label="Drag down to close sheet"><span/></motion.div>
  <header className="shorts-sheet-header"><Dialog.Title>{kind==='product'?'상세 보기':'댓글'}</Dialog.Title><Button variant="ghost" size="icon" aria-label="상세 팝업 닫기" onClick={close}><X/></Button></header>
 {children}
 </motion.section></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
