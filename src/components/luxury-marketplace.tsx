import { createLiveOrder, LiveOrderBoard } from './live-orders';
import { normalizeShipping, shippingError, type ShippingInput } from '@/lib/shipping';
import { emptyShipping, useSavedShipping } from '@/lib/use-saved-shipping';
import { ShippingFields } from './shipping-fields';
import { toast } from 'sonner';
import { ProductionMenu } from './production-menu';
import { MarketHelp } from './market-help';
import { matchesCollection, watchTypes } from '@/lib/collection-filters';
import { SellerOnboarding, SellerApprovalRedirect, useMyAccount } from './seller-account';
import { accountPage, accountUploadRole } from '@/lib/seller-approval';
import { ProfileSettings } from './profile-settings';
import { EscrowGuarantee } from './escrow';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, Bell, Star, Check, ChevronRight, Compass, Eye, Heart, Home, Menu, MessageCircle, Play, Plus, Search, Share2, ShieldCheck, ShoppingBag, SlidersHorizontal, Store, User, X } from 'lucide-react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { marketSearch, paths, postsQuery, storesQuery, type Mode } from '@/lib/market';
import { dollars, luxuryCategories, luxuryPosts, watchImages, type LuxuryPost } from '@/lib/luxury-market';
import { useMarketPreview } from './market-preview';
import { AuthDialog, UploadForm } from './marketplace';
import { supabase } from '@/integrations/supabase/client';
import { AccountView } from './role-views';
import { ProductDetailContent } from './product-detail-content';
import { ShortsPlayer } from './shorts-player';
import { BuyerBadge, SellerBadge, SellerRatings } from './reputation';
import { usePostRatings, useSellerRatingMap, withLiveRatings } from '@/lib/studio-tier';
import { SpecsTable } from './specs-table';
import { filterImmediate, isImmediateDispatch } from '@/lib/dispatch';
import { type BuyerTier } from '@/lib/reputation';
import { FeedCategoryPicker } from './feed-category-picker';
import { matchesFeedCategory } from '@/lib/feed-categories';
import { SellerDirectory } from './seller-directory';
import { CurrencySelect } from './currency';
import { NotificationInbox, NotificationsContext, useNotifications } from './notification-bell';
import { t } from '@/lib/i18n';
import { insuredPurchase } from '@/lib/insurance';
import { cashPayment } from '@/lib/loyalty';
import { CheckoutPoints, CheckoutSummary, VelaWallet } from './loyalty';
import { InsuranceBreakdown, InsuranceTeaser } from './insurance';
import { ShoppingCollection } from './shopping-collection';
import { sellerIdentity, sellerMatches } from '@/lib/seller-directory';
import { ReviewComposer, ReviewList } from './customer-reviews';
import { rankRecommended } from '@/lib/feed-ranking';
import { filterFeed, sortFeed, postFactory, type FeedFilter } from '@/lib/feed-filters';
import { FeedFilters } from './feed-filters';
import { useMediaRefresh } from '@/lib/media-refresh';
import { productEntry } from '@/lib/product-entry';
import { CryptoDepositDialog, TrustBanner, type CryptoNetwork } from './crypto-payment';
import { SellerEscrowWallet } from './seller-wallet';
import { PullToRefresh } from './pull-to-refresh';
import { discoveryListings } from '@/lib/catalog';
import { useEngagement } from '@/lib/use-engagement';
import { postMediaRoute } from '@/lib/post-media';

type View=Mode|'store'|'seller'|'admin';
export function LuxuryMarketplace({mode='home',children,shortsId,postId,help}:{mode?:View;children?:React.ReactNode;shortsId?:string;postId?:string;help?:'escrow'|'support'|'privacy'}) {
 const {data}=useSuspenseQuery(postsQuery); const ratingMap=useSellerRatingMap(); const all=withLiveRatings(luxuryPosts(data),ratingMap.data); const preview=useMarketPreview();
 const location=useRouterState({select:s=>s.location}); const search=marketSearch.parse(location.search);
 const helpPath=help==='escrow'?'/escrow-guide':help==='support'?'/support':help==='privacy'?'/privacy':undefined;
 const navigate=useNavigate(),router=useRouter(); const base=location.pathname==='/seller-store'?'/seller-store':location.pathname==='/seller-messages'?'/seller-messages':mode==='store'?'/store':mode==='seller'?'/seller':mode==='admin'?'/admin':paths[mode];
  const sheetPushed=useRef(false),searchPushed=useRef(false),categoriesPushed=useRef(false);
 const [query,setQuery]=useState(search.q || ''),[toast,setToast]=useState(''),[user,setUser]=useState<AuthUser|null>(null),[newest,setNewest]=useState(false);
 const [authReady,setAuthReady]=useState(false);
  const account=useMyAccount(user);
  const uploadRole=accountUploadRole(user?account.data:undefined);
  const myPage=accountPage(user?account.data:undefined);
 const sellerNavigation=myPage==='/seller'||(mode==='seller'&&!!account.data?.roles.includes('admin'));
 const notifications=useNotifications(user);
 const notificationPushed=useRef(false);
 const closeNotifications=()=>{if(notificationPushed.current){notificationPushed.current=false;router.history.back();}else update({notice:undefined});};
 useEffect(()=>{const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user ?? null);setAuthReady(true);});return ()=>subscription.unsubscribe();},[]);
 const queryClient=useQueryClient();
 useMediaRefresh();
 useEffect(()=>{const channel=supabase.channel('posts-live').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>{void queryClient.invalidateQueries({queryKey:['posts']});void queryClient.invalidateQueries({queryKey:['my-listings']});void queryClient.invalidateQueries({queryKey:['my-listing-count']});}).subscribe();return()=>{void supabase.removeChannel(channel);};},[queryClient]);
 useEffect(()=>{if(!search.shortSheet)sheetPushed.current=false;},[search.shortSheet]);
  useEffect(()=>{if(!search.searchOpen)searchPushed.current=false;},[search.searchOpen]);
 useEffect(()=>setQuery(search.q || ''),[search.q]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer);},[toast]);
 const update=(values:Partial<typeof search>)=>{if(postId)void navigate({to:'/post/$id',params:{id:postId},search:prev=>({...prev,...values}),resetScroll:false});else if(shortsId)void navigate({to:'/shorts/$id',params:{id:shortsId},search:prev=>({...prev,...values}),resetScroll:false});else void navigate({to:helpPath ?? base,search:prev=>({...prev,...values}),resetScroll:false});};
  const closeCategories=()=>{if(categoriesPushed.current){categoriesPushed.current=false;router.history.back();}else void navigate({to:'/',search:prev=>({...prev,categoriesOpen:undefined}),replace:true,resetScroll:false});};
  const selectCategory=(id:string)=>{categoriesPushed.current=false;void navigate({to:'/',search:prev=>({...prev,feedCategory:id==='recommend'?undefined:id,categoriesOpen:undefined,category:undefined,feedTopic:undefined}),replace:Boolean(search.categoriesOpen),resetScroll:false});};
 const closeSearch=()=>{if(searchPushed.current){searchPushed.current=false;router.history.back();}else if(shortsId)void navigate({to:'/shorts/$id',params:{id:shortsId},search:prev=>({...prev,searchOpen:undefined}),replace:true,resetScroll:false});else void navigate({to:helpPath ?? base,search:prev=>({...prev,searchOpen:undefined}),replace:true,resetScroll:false});};
 const setFeedFilter=(f:FeedFilter)=>{const next={fq:f.fq,ffactory:f.ffactory,fmin:f.fmin,fmax:f.fmax,fshorts:f.fshorts,fsort:f.fsort};if(shortsId)void navigate({to:'/shorts/$id',params:{id:shortsId},search:prev=>({...prev,...next}),replace:true,resetScroll:false});else void navigate({to:helpPath ?? base,search:prev=>({...prev,...next}),replace:true,resetScroll:false});};
 const close=()=>{if(postId&&!search.auth&&!search.menu&&!search.panel){void navigate({to:'/',search:{role:search.role},replace:true,resetScroll:false});return;}if(postId)void navigate({to:'/post/$id',params:{id:postId},search:prev=>({...prev,auth:undefined,authSignup:undefined,menu:undefined,panel:undefined}),replace:true,resetScroll:false});else if(shortsId)void navigate({to:'/shorts/$id',params:{id:shortsId},search:prev=>({...prev,auth:undefined,authSignup:undefined,menu:undefined,panel:undefined}),replace:true,resetScroll:false});else void navigate({to:helpPath ?? base,search:prev=>({...prev,...(search.auth?{auth:undefined,authSignup:undefined}:search.menu?{menu:undefined}:search.panel?{panel:undefined}:{post:undefined,detailTab:undefined})}),replace:true,resetScroll:false});};
 let posts=all.filter(p=>!preview.hidden.includes(p.id)&&(!search.q||`${p.title} ${p.creator} ${p.factory} ${p.category}`.toLowerCase().includes(search.q.toLowerCase()))&&(!search.category||search.category==='All'||p.category===search.category||p.factory===search.category));
 if(search.tab==='following') posts=posts.filter(p=>preview.isFollowing(sellerIdentity(p))).sort((a,b)=>(Date.parse(b.source?.created_at ?? '')||0)-(Date.parse(a.source?.created_at ?? '')||0));
  const {data:reviewRows}=useQuery({queryKey:['review-counts'],queryFn:async()=>{const {data:rows}=await supabase.from('reviews').select('seller_id');return rows ?? [];},staleTime:30_000});
  const postRatings=usePostRatings();
  const reviewCounts=(reviewRows ?? []).reduce<Record<string,number>>((counts,row)=>{counts[row.seller_id]=(counts[row.seller_id] ?? 0)+1;return counts;},{});
  if(mode==='home'&&(search.tab || 'discover')==='discover') posts=rankRecommended(posts,reviewCounts,Date.now(),postRatings.data ?? {}).sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));
  const storePosts=all.filter(p=>!preview.hidden.includes(p.id)&&(search.seller?sellerMatches(p,search.seller):p.sample));
  if(mode==='store'&&search.seller)posts=posts.filter(p=>storePosts.some(s=>s.id===p.id));
 if(mode==='store'&&search.storeTab==='shorts') posts=posts.filter(p=>p.short);
 if(mode==='market')posts=posts.filter(p=>matchesCollection(p,search.collection ?? 'watches',search.watchType));
 if(newest) posts=[...posts].reverse();
 const cleanHome=mode==='home'&&!shortsId&&!postId;
 const backOnlyHeader=['store','me','seller','upload'].includes(mode)||search.panel==='chat'||search.panel==='cart';
 if(mode!=='store')posts=discoveryListings(posts);
  if(cleanHome)posts=search.feedCategory==='ready'?filterImmediate(posts):posts.filter(p=>matchesFeedCategory(p,search.feedCategory));
 if(cleanHome&&search.tab!=='reviews')posts=filterFeed(posts,search);
 const selected=all.find(p=>p.id===(shortsId || postId || search.post));
 const entry=productEntry(authReady,Boolean(user));
 const guest=authReady&&!user;
 const guestSignup=()=>update({auth:true,authSignup:true});
 const guardGuest=(event:React.MouseEvent)=>{if(!guest)return;event.preventDefault();guestSignup();};
 const productSignup=entry==='signup'&&Boolean(postId||shortsId||search.post);
 const selectProduct=(event:React.MouseEvent<HTMLAnchorElement>)=>{if(entry==='product')return;event.preventDefault();if(entry==='signup')update({auth:true,authSignup:true});};
 const closeAuth=()=>{if(productSignup){void navigate({to:'/',search:{role:search.role},replace:true,resetScroll:false});}else close();};
 const shorts=discoveryListings(all).filter(p=>p.short&&!preview.hidden.includes(p.id));
 const feedFilterResults=sortFeed(filterFeed(discoveryListings(all).filter(p=>!preview.hidden.includes(p.id)),search),search.fsort);
 const quickKeywords=[...new Set(all.filter(p=>!preview.hidden.includes(p.id)).flatMap(p=>{const specs=(p.source?.specs??{}) as Record<string,unknown>;return [postFactory(p),typeof specs['brand']==='string'?specs['brand']:''].filter(Boolean);} ))].slice(0,10);
  return <NotificationsContext.Provider value={notifications}>
  <PullToRefresh disabled={Boolean(shortsId||search.auth||productSignup||search.menu||search.searchOpen||search.notice)} onError={setToast}/>
   <SellerApprovalRedirect user={user} applying={search.panel==='apply'}/>
  {!backOnlyHeader&&!postId&&!shortsId&&<header className={`lux-header ${cleanHome?'red-home-header':''}`}>
  <>
  <div className="lux-header-inner">
  <Button variant="ghost" size="icon" className="relative" aria-label={notifications.unread?`메뉴 열기 · 읽지 않은 알림 ${notifications.unread}개`:'메뉴 열기'} onClick={()=>{if(guest){guestSignup();return;}update({menu:true});}}><Menu/>{notifications.unread>0&&<span aria-hidden="true" className="absolute right-0 top-1 size-2 rounded-full bg-destructive"/>}</Button>
    <Link to="/" search={{role:search.role}} className="lux-brand" aria-label="VELA home">VELA</Link>
    <nav className="lux-header-tabs" aria-label="Feed tabs">{[['following','팔로잉'],['discover','추천'],['reviews','리뷰']].map(([tab,label])=><Button asChild variant="ghost" key={tab} className={`lux-tab ${(search.tab || 'discover')===tab?'active':''}`}><Link to="/" search={{role:search.role,feedCategory:search.feedCategory,tab:tab as 'following'|'discover'|'reviews'}} aria-current={(search.tab || 'discover')===tab?'page':undefined} resetScroll={false} onClick={guardGuest}>{label}</Link></Button>)}</nav>
   <CurrencySelect/><Button variant="ghost" size="icon" className="h-10 w-8" aria-label="Open search" onClick={()=>{if(guest){guestSignup();return;}searchPushed.current=true;update({searchOpen:true});}}><Search className="size-5"/></Button>
  </div>
   {cleanHome&&<FeedCategoryPicker selected={search.feedCategory} open={Boolean(search.categoriesOpen)} onOpen={()=>{if(guest){guestSignup();return;}categoriesPushed.current=true;update({categoriesOpen:true});}} onClose={closeCategories} onSelect={selectCategory}/>}
 </>
 </header>}
  <main className={`lux-shell ${cleanHome&&!backOnlyHeader?'red-home-shell':''} ${mode==='admin'?'backoffice-shell':''}`}>
 {!help&&(mode==='explore'||mode==='market')&&<>
  {mode==='market'&&<div className="mt-6 flex flex-wrap items-center gap-3"><Button asChild variant={search.collection!=='accessories'?'goldOutline':'ghost'}><Link to="/market" search={{role:search.role,collection:'watches'}}>시계 컬렉션</Link></Button><Button asChild variant={search.collection==='accessories'?'goldOutline':'ghost'}><Link to="/market" search={{role:search.role,collection:'accessories'}}>액세서리 컬렉션</Link></Button>{search.collection!=='accessories'&&<select className="form-input max-w-52" aria-label="시계 유형" value={search.watchType ?? 'all'} onChange={e=>update({watchType:marketSearch.shape.watchType.parse(e.target.value)})}>{watchTypes.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>}</div>}
 {mode==='explore'&&<form className="lux-search" onSubmit={e=>{e.preventDefault();update({q:query || undefined});}}><Search size={18}/><input autoFocus aria-label="Search watches" placeholder="Search watches, factories, studios…" value={query} onChange={e=>setQuery(e.target.value)}/><Button variant="ghost" size="icon" type="submit" aria-label="Search"><ArrowRight/></Button></form>}
 <nav className="lux-categories" aria-label="Categories">{luxuryCategories.map(category=><Button asChild key={category} variant="ghost" className={`lux-chip ${(search.category || 'All')===category?'active':''}`}><Link to={base} search={prev=>({...prev,category:category==='All'?undefined:category})} resetScroll={false} onClick={guardGuest}>{category}</Link></Button>)}<Button variant="ghost" size="icon" className="shrink-0" aria-label="Toggle newest first" aria-pressed={newest} onClick={()=>setNewest(p=>!p)}><SlidersHorizontal/></Button></nav>
 <div className="lux-feed-heading"><div><span className="lux-eyebrow">THE EDIT · OCTOBER 2026</span><h1>{search.q?`Results for “${search.q}”`:search.tab==='following'?'From your studios':mode==='market'?(search.collection==='accessories'?'액세서리 컬렉션':'시계 컬렉션'):'Exceptional finds.'}</h1></div><span className="curated-label"><span className="status-dot"/>Curated daily</span></div>
 </>}
 {help?<MarketHelp kind={help} user={user} requestAuth={()=>update({auth:true})}/>:cleanHome&&search.tab==='reviews'?<section className="mt-4 grid gap-4"><ReviewComposer requestAuth={()=>update({auth:true})}/><ReviewList role={search.role} posts={posts}/></section>:
 mode==='me'?(user&&(!account.data||myPage==='/seller')?<div className="lux-empty">Loading…</div>:<AccountView posts={all} user={user} onPanel={panel=>update({panel})} requestAuth={signup=>update({auth:true,authSignup:signup||undefined})}/>):
 mode==='upload'?<><div className="sample-notice">Product publishing · Account sign-in required</div><UploadForm user={user} requestAuth={()=>update({auth:true})} onPosted={()=>{void router.invalidate();void navigate({to:'/me',search:{role:search.role}});}}/></>:
  mode==='store'?search.seller?<><SellerStoreHeader post={storePosts[0]} count={storePosts.length} search={search} notify={setToast}/>{search.storeTab==='reviews'?<><h2 className="mt-6 text-base font-semibold">고객 리뷰</h2><ReviewList posts={posts} sellerId={search.seller} role={search.role}/></>:<Feed posts={posts} base={base} search={search} onSelectProduct={selectProduct}/>}</>:<><SellerDirectory posts={all.filter(p=>!preview.hidden.includes(p.id))} category={search.storeCategory} role={search.role}/></>:
  mode==='admin'||mode==='seller'?children:<div className="lux-feed-transition" key={search.tab || 'discover'}><Feed posts={posts} base={base} search={search} onSelectProduct={selectProduct}/></div>}
 </main>
 <nav className="lux-bottom-nav" aria-label="Main navigation" lang={sellerNavigation?'ko':undefined} data-no-translate={sellerNavigation?true:undefined}><div>
  <Button asChild variant="ghost" className={`lux-nav-item ${mode==='home'&&!search.panel?'active':''}`}><Link to="/" search={{role:search.role}} aria-label={sellerNavigation?'홈':'메인 페이지'}><Home aria-hidden="true"/><span>{sellerNavigation?'홈':'메인 페이지'}</span></Link></Button>
   <Button asChild variant="ghost" className={`lux-nav-item ${(sellerNavigation?location.pathname==='/seller-store':mode==='store')?'active':''}`}><Link to={sellerNavigation?'/seller-store':'/store'} search={{role:search.role}} aria-current={sellerNavigation&&location.pathname==='/seller-store'?'page':undefined} aria-label={sellerNavigation?'스토어 관리':'스토어'} onClick={guardGuest}><Store aria-hidden="true"/><span>{sellerNavigation?'스토어 관리':'스토어'}</span></Link></Button>
  {uploadRole?<Button asChild variant="gold" className="lux-upload"><Link to="/upload" search={{role:uploadRole}} aria-label="상품 올리기"><Plus aria-hidden="true"/><span className="sr-only">상품 올리기</span></Link></Button>:<Button asChild variant="gold" className="lux-upload lux-buyer-bag"><Link to="/me" search={{role:search.role,panel:'cart'}} aria-label={preview.cart.length?`장바구니 (${preview.cart.length}개)`:'장바구니'} onClick={guardGuest}><ShoppingBag aria-hidden="true"/><span className="sr-only">장바구니</span>{preview.cart.length>0&&<span className="bag-count" aria-hidden="true">{preview.cart.length}</span>}</Link></Button>}
   {sellerNavigation?<Button asChild variant="ghost" className={`lux-nav-item ${location.pathname==='/seller-messages'?'active':''}`}><Link to="/seller-messages" search={{role:'seller'}} resetScroll={false} aria-current={location.pathname==='/seller-messages'?'page':undefined} aria-label="메시지함"><span className="relative"><MessageCircle aria-hidden="true"/>{notifications.unread>0&&<span className="absolute -right-1 -top-1 size-2 rounded-full bg-destructive"/>}</span><span>메시지함</span></Link></Button>:<Button variant="ghost" className="lux-nav-item" aria-label="메시지" onClick={()=>{if(guest){guestSignup();return;}setToast('서비스 준비 중입니다.');}}><MessageCircle aria-hidden="true"/><span>메시지</span></Button>}
   <Button asChild variant="ghost" className={`lux-nav-item ${(sellerNavigation?location.pathname==='/seller':mode==='me'||mode==='seller')?'active':''}`}><Link to={sellerNavigation?'/seller':myPage} search={{role:myPage==='/seller'&&search.role!=='admin'?'seller':search.role}} aria-current={sellerNavigation&&location.pathname==='/seller'?'page':undefined} aria-label={sellerNavigation?'내 스튜디오':'나'} onClick={guardGuest}><User aria-hidden="true"/><span>{sellerNavigation?'내 스튜디오':'나'}</span></Link></Button>
</div></nav>

  {postId&&selected&&<div className="lux-detail-page"><ProductDetailContent key={selected.id} post={selected} user={user} requestAuth={()=>update({auth:true})} buy={box=>void navigate({to:'/buy/$id',params:{id:selected.id},search:{checkoutBox:box||undefined}})} notify={setToast}/></div>}
  <AnimatePresence>{entry==='product'&&selected&&!shortsId&&!postId&&<ProductDetail key={selected.id} post={selected} user={user} requestAuth={()=>update({auth:true})} close={close} buy={box=>void navigate({to:'/buy/$id',params:{id:selected.id},search:{checkoutBox:box||undefined}})} notify={setToast}/>}</AnimatePresence>
  {entry==='product'&&shortsId&&(shorts.some(p=>p.id===shortsId)?<ShortsPlayer posts={shorts} selectedId={shortsId} sheet={search.shortSheet} shortTab={search.shortTab || 'recommend'} onTab={shortTab=>update({shortTab})} onSearch={()=>{searchPushed.current=true;update({searchOpen:true});}} user={user} close={()=>void navigate({to:'/',search:{role:search.role},replace:true})} closeSheet={()=>{if(sheetPushed.current){sheetPushed.current=false;router.history.back();}else void navigate({to:'/shorts/$id',params:{id:shortsId},search:prev=>({...prev,shortSheet:undefined,shortPhoto:undefined,detailTab:undefined}),replace:true,resetScroll:false});}} change={id=>void navigate({to:'/shorts/$id',params:{id},search:prev=>({...prev,shorts:undefined,detailTab:undefined}),replace:true,resetScroll:false})} openSheet={shortSheet=>{sheetPushed.current=true;update({shortSheet});}} requestAuth={()=>update({auth:true})} buy={box=>void navigate({to:'/buy/$id',params:{id:shortsId},search:{checkoutBox:box||undefined}})} notify={setToast}/>:<Overlay title="Short unavailable" close={()=>void navigate({to:'/',search:{role:search.role},replace:true})}><Button asChild variant="goldOutline"><Link to="/" search={{role:search.role}}>Return Home</Link></Button></Overlay>)}
  {search.searchOpen&&<Dialog.Root open onOpenChange={open=>{if(!open)closeSearch();}}><Dialog.Portal><Dialog.Overlay className="lux-backdrop overlay-front"/><Dialog.Content className="lux-search-overlay" aria-describedby={undefined}><div className="lux-search-overlay-inner"><div className="lux-search-top"><Dialog.Title className="text-lg font-semibold">Search</Dialog.Title><Button variant="ghost" size="icon" aria-label="Close search" onClick={closeSearch}><X/></Button></div><FeedFilters value={{fq:search.fq,ffactory:search.ffactory,fmin:search.fmin,fmax:search.fmax,fshorts:search.fshorts,fsort:search.fsort}} count={feedFilterResults.length} onChange={setFeedFilter}/><div className="lux-search-keywords" data-no-translate role="group" aria-label="빠른 검색 키워드"><span>빠른 검색</span>{quickKeywords.map(k=><Button key={k} variant="ghost" className="lux-chip" aria-pressed={search.fq===k} onClick={()=>setFeedFilter({fq:search.fq===k?undefined:k})}>{k}</Button>)}</div><div className="lux-search-results"><Feed posts={feedFilterResults} base={base} search={{role:search.role}} onSelectProduct={selectProduct}/></div></div></Dialog.Content></Dialog.Portal></Dialog.Root>}
  {search.menu&&!search.notice&&<Overlay title="VELA" close={close} side><ProductionMenu role={search.role} notifications={<Button variant="ghost" className="min-h-11 w-full justify-start gap-3 px-2" aria-label={notifications.unread?`알림함 · 읽지 않음 ${notifications.unread}개`:'알림함'} onClick={()=>{notificationPushed.current=true;update({notice:true});}}><Bell className="size-4 text-muted-foreground"/><span className="flex-1 text-start">알림함</span>{notifications.unread>0&&<span className="rounded-full bg-destructive px-2 text-xs text-destructive-foreground">{notifications.unread>99?'99+':notifications.unread}</span>}<ChevronRight className="size-4 text-muted-foreground"/></Button>}/></Overlay>}
  <NotificationInbox user={user} open={Boolean(search.notice)} onClose={closeNotifications} notifications={notifications}/>
 {entry==='product'&&(search.post||postId)&&!selected&&<Overlay title="Product unavailable" close={close}><p className="py-6 text-sm text-muted-foreground">This listing is no longer available.</p></Overlay>}
 {(search.auth||productSignup)&&<AuthDialog key={search.authSignup?'signup':'login'} initialSignup={Boolean(search.authSignup||productSignup)} onClose={closeAuth} onSignedIn={close}/>}
  {search.panel&&(search.panel==='orders'&&!user?<Overlay title="주문 내역 · 에스크로 상태" close={close}><p className="my-5 text-sm text-muted-foreground">로그인하면 내 주문의 QC 자료, 에스크로 상태와 배송 추적을 확인할 수 있습니다.</p><Button variant="goldOutline" onClick={()=>update({panel:undefined,auth:true})}>로그인하고 내 주문 확인</Button></Overlay>:<CommercePanel posts={all} onBuy={post=>update({checkoutItem:post.id,panel:'checkout'})} panel={search.panel} user={user} selected={search.panel==='checkout'&&search.checkoutItem?all.find(post=>post.id===search.checkoutItem):selected} close={close} onPanel={panel=>update({panel})} notify={setToast}/>)}
 {toast&&<div className="lux-toast" role="status"><Check size={16}/>{toast}</div>}
 </NotificationsContext.Provider>;
}
function Feed({posts,base,search,onSelectProduct}:{onSelectProduct?:(event:React.MouseEvent<HTMLAnchorElement>)=>void;posts:LuxuryPost[];base:'/'|'/explore'|'/market'|'/me'|'/upload'|'/store'|'/seller'|'/seller-store'|'/seller-messages'|'/admin';search:ReturnType<typeof marketSearch.parse>}) {
 const preview=useMarketPreview();const engagement=useEngagement();const compact=base==='/';const columns=compact?2:3;
 return posts.length?<div className={`lux-waterfall ${compact?'red-home-waterfall':''}`}>{Array.from({length:columns},(_,i)=>i).map(column=><div className="lux-column" key={column}>{posts.filter((_,i)=>i%columns===column).map((post,i)=><article className="lux-post" key={post.id}>
  <Link onClick={onSelectProduct} to={postMediaRoute(post)} params={{id:post.id}} search={{role:search.role}} className={`lux-post-media shape-${(column+i)%3} ${post.outOfStock?'is-sold-out':''}`} aria-label={post.title}>{post.video?<FeedVideo post={post}/>:<img src={post.images[0]} alt={post.title} width={512} height={512} loading={i<4?'eager':'lazy'} decoding="async" fetchPriority={i<2?'high':'auto'} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=watchImages[0] ?? '';}}/>}{post.outOfStock&&<span className="lux-soldout" data-no-translate>SOLD OUT</span>}{!post.outOfStock&&isImmediateDispatch(post)&&<span className="lux-ready-badge" data-no-translate>바로 발송</span>}{!compact&&<><span className="lux-views"><Eye size={12}/>{post.views}<span className="views-word"> views</span></span><span className="lux-bag"><ShoppingBag size={15}/></span></>}</Link>
 <div className="lux-post-copy">{!compact&&<div className="lux-post-tags"><span>{post.factory}</span>{(preview.audits[post.id]?preview.audits[post.id]==='Approved':post.verified)&&<ShieldCheck size={12}/>}</div>}<Link onClick={onSelectProduct} to={postMediaRoute(post)} params={{id:post.id}} search={{role:search.role}}><h2>{post.title}</h2></Link>{!compact&&post.price!==null&&<p className="lux-card-price">{dollars(post.price)}</p>}<div className="lux-post-creator" lang="ko" data-no-translate><Link to="/store" search={{role:search.role,seller:sellerIdentity(post)}}><img src={post.images[0]} width={20} height={20} alt=""/><span className="lux-card-seller-name" title={post.creator}>{post.creator}</span><SellerBadge reputation={post.reputation} compact/></Link><div className="lux-post-engagement" role="group" aria-label="좋아요 및 저장"><Button variant="ghost" className={`lux-heart ${engagement.likedIds.has(post.id)?'active':''}`} aria-label={`좋아요 ${post.title}`} title="내 좋아요 · 선택 1 / 미선택 0" aria-pressed={engagement.likedIds.has(post.id)} disabled={engagement.busy} onClick={()=>engagement.toggleLike(post.id)}><Heart fill={engagement.likedIds.has(post.id)?'currentColor':'none'}/><span>{Number(engagement.likedIds.has(post.id))}</span></Button><Button variant="ghost" className={`lux-heart lux-save ${preview.saved.includes(post.id)?'active':''}`} aria-label={`저장 ${post.title}`} title="이 기기의 내 저장 · 선택 1 / 미선택 0" aria-pressed={preview.saved.includes(post.id)} onClick={()=>preview.toggleSaved(post.id)}><Star fill={preview.saved.includes(post.id)?'currentColor':'none'}/><span>{Number(preview.saved.includes(post.id))}</span></Button></div></div></div>
 </article>)}</div>)}</div>:<div className="lux-empty"><Compass/><h2>No finds here yet.</h2><p>Follow a studio or choose another category.</p><Button asChild variant="goldOutline"><Link to="/store">Explore VS Watch Studio<ArrowRight/></Link></Button></div>;
}
function FeedVideo({post}:{post:LuxuryPost}) {
 const hasPhoto=Boolean(post.sample||post.source?.thumbnail_url||post.source?.media_urls.length);
 return <span className="feed-video-frame">{hasPhoto||!post.video?<img src={post.images[0]} alt={`${post.title} 영상 썸네일`} loading="lazy"/>:<video src={`${post.video}#t=0.5`} preload="metadata" muted playsInline aria-label={`${post.title} 영상 썸네일`}/>}<span className="feed-video-play" aria-hidden="true"><Play size={18} fill="currentColor"/></span></span>;
}
function ProductDetail({post,user,requestAuth,close,buy,notify}:{post:LuxuryPost;user:AuthUser|null;requestAuth:()=>void;close:()=>void;buy:(box:boolean)=>void;notify:(s:string)=>void}) {
 const reduced=useReducedMotion();
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Overlay asChild><motion.div className="lux-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}/></Dialog.Overlay><Dialog.Content asChild aria-describedby={undefined}><motion.div className="lux-detail" initial={{y:reduced?0:'100%'}} animate={{y:0}} exit={{y:reduced?0:'100%'}} transition={{type:'spring',damping:32,stiffness:300}}><div className="shorts-sheet-header"><Dialog.Title>제품 상세</Dialog.Title><Button variant="ghost" size="icon" aria-label="Close product" onClick={close}><X/></Button></div><ProductDetailContent post={post} user={user} requestAuth={requestAuth} buy={buy} notify={notify}/></motion.div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Overlay({title,close,children,side=false,back=false}:{title:string;close:()=>void;children:React.ReactNode;side?:boolean;back?:boolean}) {
 return <Dialog.Root open onOpenChange={open=>{if(!open)close();}}><Dialog.Portal><Dialog.Overlay className="lux-backdrop overlay-front"/><Dialog.Content className={side?'lux-menu':'lux-dialog'} aria-describedby={undefined}><div className={`flex items-center gap-3 ${back?'':'justify-between'}`}><Dialog.Title className={back?'sr-only':'text-xl font-semibold'}>{title}</Dialog.Title><Button variant="ghost" size="icon" aria-label={back?'뒤로가기':'Close dialog'} onClick={close}>{back?<ArrowLeft/>:<X/>}</Button></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function CommercePanel({posts,onBuy,panel,user,selected,close,onPanel,notify}:{user:AuthUser|null;posts:LuxuryPost[];onBuy:(post:LuxuryPost)=>void;panel:string;selected:LuxuryPost|undefined;close:()=>void;onPanel:(panel:'checkout')=>void;notify:(s:string)=>void}) {
 const account=useMyAccount(user);
 const preview=useMarketPreview();const [sent,setSent]=useState(false),[message,setMessage]=useState(''),[messages,setMessages]=useState<string[]>([]);
 const item=selected || preview.cart[0];
 return <Overlay back={panel==='chat'||panel==='cart'} title={({chat:'Chat with studio',cart:'Your shopping bag',wishlist:'저장 상품 · 위시리스트',checkout:'Order preview',settings:'프로필 편집',apply:'Become a Vela seller',orders:'Escrow order board',wallet:'VELA Wallet'} as Record<string,string>)[panel] || 'My Vela'} close={close}>
 {panel==='chat'?<div className="py-10 text-center" lang="ko" data-no-translate><MessageCircle className="mx-auto mb-4 text-primary" size={36}/><h2 className="text-lg font-semibold">서비스 준비 중입니다.</h2><p className="mt-3 text-sm text-muted-foreground">고객과 셀러 간 1:1 대화 기능은 현재 준비 중입니다. 대화는 고객이 셀러를 팔로우한 뒤에 열릴 예정입니다.</p></div>:
 panel==='wishlist'?<div className="mt-6"><div className="section-heading"><h2>저장 상품</h2><span>{posts.filter(p=>preview.saved.includes(p.id)).length}</span></div><Feed posts={posts.filter(p=>preview.saved.includes(p.id))} base="/me" search={{panel:'wishlist'}}/></div>:panel==='cart'?<ShoppingCollection posts={posts} onBuy={onBuy}/>: panel==='checkout'?sent?<div className="py-8 text-center"><Check className="mx-auto mb-4 text-primary" size={36}/><h2 className="text-lg font-semibold">Sample order created</h2><p className="mt-3 text-sm text-muted-foreground">Awaiting payment. No charge has been made.</p><Button asChild variant="goldOutline" className="mt-6"><Link to="/me" search={{panel:'orders'}}>View orders</Link></Button></div>:<><p className="sample-notice">Preview checkout · Payment is not connected</p>{item?<CheckoutForm item={item} onDone={()=>setSent(true)}/>:<p className="py-8 text-muted-foreground">Add a product to your bag first.</p>}</>:
 panel==='apply'?<SellerOnboarding/>:
 panel==='wallet'?(user&&account.data?.roles.includes('seller')?<SellerEscrowWallet user={user}/>:<VelaWallet/>):
 panel==='orders'?<><LiveOrderBoard as="buyer"/></>:
 <ProfileSettings user={user}/>}
 </Overlay>;
}
function SellerStoreHeader({post,count,search,notify}:{post:LuxuryPost|undefined;count:number;search:ReturnType<typeof marketSearch.parse>;notify:(message:string)=>void}) {
  const preview=useMarketPreview(),following=post?preview.isFollowing(sellerIdentity(post)):false;
 return <><div className="store-profile mt-8">{post&&<img src={post.images[0]} className="store-avatar" alt={post.creator}/>}<div className="store-title" data-no-translate><h1>{post?.creator || 'Seller unavailable'}{post&&<SellerBadge reputation={post.reputation} withRating/>}</h1>{post&&<div className="store-actions"><Button variant="goldOutline" aria-pressed={following} onClick={()=>preview.toggleSeller(sellerIdentity(post))}>{following?<Check/>:<Plus/>}{following?'Following':'Follow'}</Button><Button variant="ghost" aria-label="셀러에게 메시지" title="메시지" onClick={()=>notify('서비스 준비 중입니다.')}><MessageCircle size={18}/><span>메시지</span></Button></div>}</div>{post&&<p className="store-bio">{post.sample?'Independent watch curation. Thoughtful details, precise movements.':post.description}</p>}<div className="store-stats"><span><strong>{count}</strong> Products</span></div><StoreInfo name={post?.creator}/>{post&&<SellerRatings reputation={post.reputation}/>}</div><nav className="lux-tabs store-tabs">{(['products','shorts','reviews'] as const).map(tab=><Button key={tab} asChild variant="ghost" className={`lux-tab ${(search.storeTab || 'products')===tab?'active':''}`}><Link to="/store" search={{role:search.role,seller:search.seller,storeTab:tab}} resetScroll={false}>{tab==='reviews'?'Customer Reviews':`${tab[0]?.toUpperCase()}${tab.slice(1)}`}</Link></Button>)}</nav></>;
}
function StoreInfo({name}:{name:string|undefined}){
 const {data}=useQuery(storesQuery); const store=data?.find(s=>s.store_name===name);
 if(!store)return null;
 const place=[store.city,store.country].filter(Boolean).join(', ');
 return <div className="store-info" data-no-translate>{store.cover_image&&<img src={store.cover_image} alt="" className="store-cover"/>}{store.verification_status!=='UNVERIFIED'&&<span className="store-verify"><ShieldCheck size={13}/>{store.verification_status}</span>}{place&&<p><strong>Location</strong> {place}</p>}{store.specialties.length>0&&<p><strong>Specialties</strong> {store.specialties.join(' · ')}</p>}{store.response_time&&<p><strong>Response</strong> {store.response_time}</p>}{(store.shipping_regions.length>0||store.shipping_information)&&<p><strong>Shipping</strong> {[store.shipping_regions.join(', '),store.shipping_information].filter(Boolean).join(' — ')}</p>}</div>;
}
function Reviews(){const memberships:BuyerTier[]=['gold','silver','member'];return <div className="review-list">{[['A. Chen','Beautiful finishing. The studio shared detailed photos before shipping.'],['J. Park','Quick communication and a carefully packed watch.'],['M. Lee','The dial looks even better in person.']].map(([name,text],index)=><article key={name}><div className="flex justify-between"><div className="review-author"><strong>{name}</strong><BuyerBadge tier={memberships[index] ?? 'member'}/></div><span className="text-primary">★★★★★</span></div><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p><span className="mt-3 block text-xs text-muted-foreground">Sample review · Verified purchase preview</span></article>)}</div>;}

export function CheckoutForm({item,onDone}:{item:LuxuryPost;onDone:()=>void}){
 const preview=useMarketPreview(),p=preview.profile;
 const checkoutSearch=useRouterState({select:s=>marketSearch.parse(s.location.search)});
 const [box,setBox]=useState(Boolean(checkoutSearch.checkoutBox));
 const ship=useSavedShipping();
 const [f,setF]=useState<ShippingInput>(emptyShipping); const [remember,setRemember]=useState(true); const loaded=useRef(false);
 useEffect(()=>{if(loaded.current||ship.loading)return;loaded.current=true;if(ship.saved)setF(ship.saved);else setF({...emptyShipping,recipient:p.recipient||'',phone:p.phone.startsWith('@')?'':p.phone,line1:p.address,postal:p.postal});},[ship.loading,ship.saved,p]);
  const price=item.price ?? 0, boxPrice=item.boxPrice ?? 0;
  const [network,setNetwork]=useState<CryptoNetwork>('USDT-TRC20'); const [deposit,setDeposit]=useState(false); const [points,setPoints]=useState(0); const [err,setErr]=useState('');
  const qc=useQueryClient();
  const productUsd=price+(box?boxPrice:0), purchase=insuredPurchase(price,box?boxPrice:0), cash=cashPayment(purchase.total,points);
 return <form className="checkout-form" onSubmit={e=>{e.preventDefault();const bad=shippingError(f);setErr(bad);if(!bad)setDeposit(true);}}>
  <TrustBanner/>
  <div className="cart-line"><img src={item.images[0]} width={64} height={64} alt=""/><div><p>{item.title}</p><p className="mt-2 text-primary">{dollars(price)}</p></div></div>
  {boxPrice>0&&<label className="box-option"><input type="checkbox" checked={box} onChange={e=>setBox(e.target.checked)} className="size-4 accent-primary"/><span>{t('addBox')}</span><strong>+{dollars(boxPrice)}</strong></label>}
  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">배송 정보 <span className="text-[11px] font-normal text-muted-foreground">· 모든 항목 필수</span></h3>{ship.saved&&<Button type="button" variant="ghost" size="sm" onClick={()=>ship.saved&&setF(ship.saved)}>저장된 배송지 불러오기</Button>}</div>
  <ShippingFields value={f} onChange={setF} idPrefix="checkout"/>
  <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="size-4 accent-primary" checked={remember} onChange={e=>setRemember(e.target.checked)}/>이 배송지를 내 페이지에 저장</label>
  {err&&<p role="alert" className="text-xs text-destructive">{err}</p>}
  <details><summary>결제 명세 · 포인트 사용</summary>
    <CheckoutPoints product={productUsd} points={points} onChange={setPoints}/>
    <CheckoutSummary product={productUsd} insurance={purchase.insurance} total={purchase.total} points={points}/>
  </details>
  <div className="checkout-total"><span className="text-xs text-muted-foreground">총 결제 금액 · 보험료 포함</span><strong data-no-translate>{cash.toFixed(2)} USDT</strong></div>
  <p className="text-[11px] leading-5 text-muted-foreground">배송비·관세는 판매자 및 수령국 안내를 따릅니다. 카드 결제 수수료는 MoonPay에서 별도로 확인하세요.</p>
  <Button variant="gold" className="w-full" type="submit">안전 에스크로 결제하기<ShieldCheck size={16}/></Button>
  {deposit&&<CryptoDepositDialog network={network} usd={cash} onNetwork={setNetwork} onClose={()=>setDeposit(false)} onSubmit={async txid=>{setDeposit(false);try{await createLiveOrder({post_id:item.id,title:item.title,image_url:item.images[0]?.startsWith('http')?item.images[0]:undefined as never,amount_usd:purchase.total,product_amount_usd:productUsd,points_redeemed:points,seller_id:item.sample?null:item.source.user_id??null,seller_name:item.creator,network,txid,shipping:normalizeShipping(f)});if(remember)await ship.save(f).catch(console.error);preview.order(item);await qc.invalidateQueries();toast.success('결제 완료 및 에스크로 보관 — 주문이 등록되었습니다.');onDone();}catch(e){console.error(e);toast.error('주문을 저장하지 못했습니다. 다시 시도해 주세요.');}}}/>}
 </form>;
}
