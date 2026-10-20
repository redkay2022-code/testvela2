import { isImmediateDispatch } from '@/lib/dispatch';
import { avatarKey, defaultAvatarUrl } from '@/lib/default-avatar';
import { StreamVideo } from './stream-video';
import { useRef, useState } from 'react';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Star, Check, Eye, MessageCircle, Plus, ShieldCheck, Share2, UserRound } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { useMarketPreview } from './market-preview';
import { SellerRatings } from './reputation';
import { ShortsGallery } from './shorts-gallery';
import { SpecsTable } from './specs-table';
import { Tx } from './tx';
import { usePostTranslation, TranslationToggle } from './post-translation';
import { EscrowGuarantee } from './escrow';
import { insuredPurchase } from '@/lib/insurance';
import { EarnHint, useInsuranceRate } from './loyalty';
import { exceedsPriceCap } from '@/lib/price-cap';
import { InsuranceOption } from './insurance-option';
import { ProductComments } from './product-comments';
import { marketSearch } from '@/lib/market';
import { dollars, type LuxuryPost } from '@/lib/luxury-market';
import { sellerIdentity } from '@/lib/seller-directory';
import { TEST_COUNTS_ENABLED, shownViews, testPostLikes, testPostSaves, testSellerStat } from '@/lib/test-counts';
import { t } from '@/lib/i18n';
import { usePostRatings } from '@/lib/studio-tier';
import { detailMedia } from '@/lib/post-media';
import { ratingAverage } from '@/lib/reputation';
import { loadSellerAvatar } from '@/lib/seller-avatar';
import { useQuery } from '@tanstack/react-query';
import { useSellerPurchaseBlock } from '@/lib/seller-role';

export function ProductDetailContent({post,user,requestAuth,buy,notify,shorts=false}:{post:LuxuryPost;user:User|null;requestAuth:()=>void;buy:(box:boolean,insured?:boolean)=>void;notify:(text:string)=>void;shorts?:boolean}) {
 const preview=useMarketPreview(),navigate=useNavigate(),router=useRouter();
 const search=useRouterState({select:s=>marketSearch.parse(s.location.search)});
 const pushed=useRef(false),[box,setBox]=useState(false),[insured,setInsured]=useState(false);
 const insRate=useInsuranceRate(),insPct=+(insRate*100).toFixed(2);
 const pr=usePostRatings().data?.[post.id];
 const sellerAvg=ratingAverage(post.reputation),sellerCount=post.reputation.ratingCount;
 const sellerAvatar=useQuery({queryKey:['seller-header-avatar',post.source.store_id ?? post.source.user_id ?? null],enabled:!post.sample&&Boolean(post.source.store_id||post.source.user_id),queryFn:()=>loadSellerAvatar({data:{storeId:post.source.store_id ?? undefined,userId:post.source.user_id ?? undefined}})});
 const tr=usePostTranslation(post.source,!post.sample,false);
 const verified=preview.audits[post.id]?preview.audits[post.id]==='Approved':post.verified;
 const qna=search.detailTab==='qna',boxPrice=post.boxPrice ?? 0,story=post.menuCategory==='스토리';
 const sellerBlocked=useSellerPurchaseBlock(user?.id);
 const ownProduct=Boolean(user&&!post.sample&&post.source.user_id===user.id),overCap=post.price!==null&&exceedsPriceCap(post.price,box?boxPrice:0);
 const openQna=()=>{pushed.current=true;void navigate({to:'.',search:prev=>({...prev,detailTab:'qna'}),resetScroll:false});};
 const closeQna=()=>{if(pushed.current){pushed.current=false;router.history.back();}else void navigate({to:'.',search:prev=>({...prev,detailTab:undefined}),replace:true,resetScroll:false});};
 const share=async()=>{try{const url=new URL(`/post/${post.id}`,window.location.origin).href;if(navigator.share)await navigator.share({title:post.title,url});else{await navigator.clipboard.writeText(url);notify('상품 링크를 복사했습니다.');}}catch{/* Share dismissed */}};
 return <>
 <header className={shorts?"shorts-sheet-seller":"shorts-sheet-seller product-detail-header"} aria-label="판매자 정보" data-no-translate translate="no"><span className="shorts-anonymous-avatar shrink-0 seller-header-avatar">{(sellerAvatar.data?.avatar??(sellerAvatar.isLoading?null:defaultAvatarUrl(avatarKey(post.source.user_id ?? post.source.store_id ?? post.creator),post.creator)))?<img src={sellerAvatar.data?.avatar??defaultAvatarUrl(avatarKey(post.source.user_id ?? post.source.store_id ?? post.creator),post.creator)} alt={`${post.creator} 프로필 사진`} className="size-full rounded-full object-cover"/>:<UserRound/>}</span><div className="seller-header-info" data-no-translate><span className="seller-header-name"><strong data-i18n-skip className="notranslate" translate="no">{post.creator}</strong>{verified&&<ShieldCheck size={13} className="seller-header-verified" aria-label="VELA VERIFIED"/>}</span><span className="seller-header-rating notranslate" translate="no"><Star size={11} aria-hidden/>{sellerAvg===null?<Tx>평점 없음</Tx>:`${sellerAvg.toFixed(1)} (${sellerCount ?? 0})`}</span></div><Button variant="goldOutline" size="sm" className="seller-follow-button" aria-pressed={preview.isFollowing(sellerIdentity(post))} onClick={()=>preview.toggleSeller(sellerIdentity(post))}>{preview.isFollowing(sellerIdentity(post))?<Check size={13}/>:<Plus size={13}/>} <Tx>{preview.isFollowing(sellerIdentity(post))?'팔로잉':'팔로우'}</Tx></Button><Button asChild variant="gold" size="sm" className="seller-store-cta"><Link to="/store" search={{role:search.role,seller:sellerIdentity(post),storeTab:'products'}} className="notranslate" translate="no"><Tx>셀러 스토어 들어가기</Tx></Link></Button>{!shorts&&<Button variant="ghost" size="icon" className="seller-share-button" aria-label="상품 공유" title="공유" onClick={share}><Share2/></Button>}</header>
 <div className={shorts?'shorts-sheet-body':'lux-detail-scroll'}>
 {qna?<div className="lux-detail-copy"><Button variant="ghost" size="sm" onClick={closeQna}><ArrowLeft size={16}/>제품 상세</Button><h2 className="mt-4 text-lg font-semibold notranslate" translate="no" data-i18n-skip>{post.sample?post.title:tr.title}</h2><ProductComments key={post.id} postId={post.id} user={user} requestAuth={requestAuth} qna/></div>:<>
 {shorts?<ShortsGallery key={post.id} images={post.images} title={post.title}/>:<ProductPhotos post={post} verified={verified}/>}
 <div className="lux-detail-copy"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">{post.price!==null&&<p className="lux-price min-w-0" data-no-translate>{dollars(post.price+(box?boxPrice:0))}</p>}<span className="text-xs text-muted-foreground"><Eye size={13} className="mr-1 inline"/>{shownViews(post.id,post.views)} views</span></div>{TEST_COUNTS_ENABLED&&<p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-no-translate translate="no"><span>Likes <strong>{testPostLikes(post.id)}</strong></span><span>Saves <strong>{testPostSaves(post.id)}</strong></span><span>Followers <strong>{testSellerStat(sellerIdentity(post)).followers}</strong></span></p>}
 {post.price!==null&&boxPrice>0&&<label className="box-option"><input type="checkbox" checked={box} onChange={e=>setBox(e.target.checked)} className="size-4 accent-primary"/><span>{t('addBox')}</span><strong data-no-translate>+{dollars(boxPrice)}</strong></label>}
 {post.price!==null&&<InsuranceOption price={post.price} checked={insured} onChange={setInsured} rate={insRate}/>}
 {post.price!==null&&<dl className="insurance-breakdown" aria-label="안전배송보험"><div><dt><ShieldCheck size={15} className="mr-1 inline"/>{t('deliveryInsurance')} ({insPct}%)</dt><dd data-no-translate>+{dollars(insuredPurchase(post.price,0,insured,insRate).insurance)}</dd></div><div className="insurance-total"><dt>{t('total')}</dt><dd data-no-translate>{dollars(insuredPurchase(post.price,box?boxPrice:0,insured,insRate).total)}</dd></div></dl>}
 {post.price!==null&&<EarnHint price={post.price+(box?boxPrice:0)}/>}
 {post.price!==null&&(ownProduct||sellerBlocked||overCap)&&<p role="alert" className="mt-2 text-xs text-destructive">{ownProduct?<Tx>내가 올린 상품은 구매할 수 없습니다.</Tx>:sellerBlocked?<Tx>셀러 계정은 상품을 구매할 수 없습니다.</Tx>:<Tx>판매 최고가($3,500)를 넘는 상품은 구매할 수 없습니다.</Tx>}</p>}
 {isImmediateDispatch(post)&&<span className="lux-ready-badge is-inline mt-4" data-no-translate><Tx>바로 발송 · Ready to Ship</Tx></span>}<h2 className="mt-4 text-xl font-semibold leading-relaxed notranslate" translate="no" data-no-translate data-i18n-skip>{post.sample?post.title:tr.title}</h2><p className="mt-1 text-xs text-muted-foreground">{pr?<><span className="text-primary">★ {pr.average.toFixed(1)}</span>{` · 구매자 리뷰 ${pr.count}개`}</>:<Tx>구매자 평점 없음</Tx>}</p>{(verified||post.sample)&&<div className="detail-tags">{verified&&<span>✓ VELA VERIFIED</span>}{post.sample&&<span>Studio sample</span>}</div>}<h3 className="mt-5 text-sm font-semibold"><Tx>제품 소개</Tx></h3><p className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground notranslate" translate="no" data-no-translate data-i18n-skip>{post.sample?post.description:tr.description}</p><TranslationToggle t={tr}/>
 {!story&&<SpecsTable category={post.category} dispatch={post.source.dispatch_time} specs={post.sample?post.source.specs:tr.specs} fallback={post.sample?<dl className="lux-specs"><div><dt>Specification</dt><dd>1:1 studio specification</dd></div><div><dt>Case & bracelet</dt><dd>Stainless steel</dd></div><div><dt>Crystal</dt><dd>Sapphire</dd></div><div><dt>Movement</dt><dd>Automatic mechanical</dd></div></dl>:<p className="mt-5 text-sm text-muted-foreground">등록된 사양이 없습니다.</p>}/>}
 {!story&&<> <div className="mt-7 border-t border-border pt-5"><h3 className="text-sm font-medium">Studio notes</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{post.sample?'Sample product, pricing and verification. No brand affiliation or real inspection claim.':'Contact the studio to confirm specifications and availability.'}</p></div><EscrowGuarantee/><SellerRatings reputation={post.reputation}/></>}<ProductComments postId={post.id} user={user} requestAuth={requestAuth}/></div></>}
 </div>
 <footer className="product-shopping-actions"><Button variant="ghost" className="product-qna-button" aria-label="셀러에게 메시지" title="메시지" onClick={()=>notify('서비스 준비 중입니다.')}><MessageCircle size={20}/><span><Tx>메시지</Tx></span></Button><Button variant="ghost" className="product-qna-button" aria-label="상품 Q&A 열기" aria-pressed={qna} title="상품 Q&A" onClick={()=>qna?closeQna():openQna()}><MessageCircle size={20}/><span>Q&A</span></Button><Button variant="ghost" size="icon" aria-label="상품 저장" title="저장" aria-pressed={preview.saved.includes(post.id)} onClick={()=>preview.toggleSaved(post.id)}><Star fill={preview.saved.includes(post.id)?'currentColor':'none'}/></Button>{post.price!==null&&<><Button variant="goldOutline" onClick={()=>{preview.addCart(post);notify('장바구니에 담았습니다.');}}><span data-i18n-skip className="notranslate" translate="no">{t('addCart')}</span></Button><Button variant="gold" disabled={ownProduct||sellerBlocked||overCap} onClick={()=>buy(box,insured)}><span data-i18n-skip className="notranslate" translate="no">{t('buyNow')}</span><ArrowRight size={14}/></Button></>}</footer>
 </>;
}
function ProductPhotos({post,verified}:{post:LuxuryPost;verified:boolean}) {
 const carousel=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null),[slide,setSlide]=useState(0);
 const media=detailMedia(post);
 const onSlide=(index:number)=>{setSlide(index);if(index!==0)video.current?.pause();};
 return <><div className="lux-carousel-wrap"><div className="lux-carousel" ref={carousel} onScroll={e=>onSlide(Math.round(e.currentTarget.scrollLeft/e.currentTarget.clientWidth))}>{media.map((item,i)=>item.kind==='video'?<StreamVideo key="video" ref={video} className="lux-detail-video" src={item.src} poster={post.images[0]} controls playsInline muted loop autoPlay preload="auto" aria-label={`${post.title} 상품 영상`}/>:<img key={i} src={item.src} width={512} height={512} alt={`${post.title} · 상세 사진 ${post.video?i:i+1}`} loading={i<2?'eager':'lazy'} decoding="async" fetchPriority={i===0||(i===1&&post.video)?'high':'auto'}/>)}</div><span className="lux-counter">{slide+1}/{media.length}</span>{verified&&<span className="lux-verified"><ShieldCheck size={14}/> VELA VERIFIED</span>}</div>{media.length>1&&<div className="carousel-controls"><Button size="icon" variant="ghost" aria-label="이전 미디어" disabled={slide===0} onClick={()=>carousel.current?.scrollBy({left:-carousel.current.clientWidth,behavior:'smooth'})}><ArrowLeft/></Button>{media.map((_,i)=><span key={i} className={`carousel-dot ${slide===i?'active':''}`}/>)}<Button size="icon" variant="ghost" aria-label="다음 미디어" disabled={slide===media.length-1} onClick={()=>carousel.current?.scrollBy({left:carousel.current.clientWidth,behavior:'smooth'})}><ArrowRight/></Button></div>}</>;
}
