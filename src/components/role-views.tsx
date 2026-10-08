import { AdminDashboard } from './admin-dashboard';
import { AdminToggle, useMyAccount } from './seller-account';
import { useAvatarUrl } from '@/lib/avatar';
import { SellerOrderControl } from './escrow';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowRight, BadgeCheck, Check, ChevronRight, CreditCard, DollarSign, FileCheck, Heart, Package, Plus, Pencil, Settings, ShieldCheck, Store, TrendingUp, Truck, User, Users, Video, X } from 'lucide-react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { dollars, type LuxuryPost } from '@/lib/luxury-market';
import { marketSearch } from '@/lib/market';
import { useMarketPreview } from './market-preview';
import { BuyerBadge, StudioTierBadge, StudioTierPanel } from './reputation';
import { studioReputation, ratingDowngradeAlert, ratingAverage, sellerTier, studioNames } from '@/lib/reputation';
import { useNotifications } from './notification-bell';
import { Bell, AlertTriangle, Star } from 'lucide-react';
import { accountSellerTier } from '@/lib/seller-approval';
import { useStudioReputation } from '@/lib/studio-tier';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TierBenefits } from './insurance';
import { MembershipCard } from './loyalty';
import { MyActivity } from './my-activity';
import { LiveOrderBoard } from './live-orders';
import { formatMoney } from '@/lib/currency';

function SellerStats(){
 const q=useQuery({queryKey:['seller-stats'],queryFn:async()=>{const {data,error}=await supabase.rpc('seller_dashboard_stats');if(error)throw error;return data as Record<string,number>|null;},refetchInterval:30000});
 const d=q.data;const v=(k:string)=>d?String(d[k]??0):'—';
 const items:[string,string,typeof Users][]=[['팔로워',v('followers'),Users],['판매 중',v('selling'),Store],['판매 완료',v('sold_out'),Check],['주문 수',v('orders'),Package],['장바구니 담김',v('cart'),Heart],['제작·검수 진행',v('preparing'),FileCheck],['에스크로 입금 예정',d?formatMoney(Number(d['escrow_pending_usd']??0)):'—',DollarSign]];
 return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 my-4">{items.map(([l,val,Icon])=><div key={l} className="seller-flow-card"><Icon size={16} className="text-primary"/><strong className="mt-1 block text-lg">{val}</strong><small className="text-muted-foreground">{l}</small></div>)}</div>;
}

export function RoleSwitcher(){
 const location=useRouterState({select:s=>s.location}),search=marketSearch.parse(location.search),navigate=useNavigate();
 return <div className="role-switch" aria-label="Sample account role">{[['buyer','Buyer'],['seller','Seller'],['admin','Super Admin']].map(([role,label])=><Button key={role} variant="ghost" aria-pressed={(search.role || 'buyer')===role} className={(search.role || 'buyer')===role?'active':''} onClick={()=>void navigate({to:'.',search:prev=>({...prev,role:role as 'buyer'|'seller'|'admin'})})}>{label}</Button>)}</div>;
}
export function AccountView({posts,user,onPanel,requestAuth}:{posts:LuxuryPost[];user:AuthUser|null;onPanel:(panel:'orders'|'settings'|'apply'|'wallet')=>void;requestAuth:(signup?:boolean)=>void}){
 const search=marketSearch.parse(useRouterState({select:s=>s.location.search})),p=useMarketPreview();
 const role=search.role || 'buyer';const acct=useMyAccount(user);const avatarUrl=useAvatarUrl(acct.data?.profile?.avatar_url);const saved=posts.filter(post=>p.saved.includes(post.id));
 const sellerReputation=useStudioReputation(user&&acct.data?.roles.includes('seller')?user.id:null);const badgeTier=accountSellerTier(user?acct.data:undefined,sellerReputation.data?.reputation);
 return <div className="account-page"><div className="account-heading"><span className="lux-eyebrow">YOUR PERSONAL COLLECTION</span><h1>My Vela</h1></div><div className="account-profile"><div className="account-avatar">{avatarUrl?<img src={avatarUrl} alt="프로필 사진" className="size-full rounded-full object-cover"/>:<User size={44}/>}</div><div><div className="account-name-line"><h2><span data-no-translate>{user?(acct.data?.profile?.nickname ?? 'Vela Member'):p.profile.name}</span></h2>{badgeTier?<StudioTierBadge tier={badgeTier}/>:<BuyerBadge/>}</div>{user&&acct.data?.profile&&<small className="block text-xs text-muted-foreground" data-no-translate>#{acct.data.profile.system_code}</small>}<span className="text-sm text-muted-foreground">{role==='admin'?'Platform owner':badgeTier?'Studio account':'Collector account'}</span></div>{user?<Button variant="goldOutline" size="sm" className="ml-auto shrink-0" onClick={()=>onPanel('settings')}><Pencil size={15}/>편집</Button>:<div className="ml-auto flex shrink-0 flex-wrap gap-2" role="group" aria-label="회원 계정"><Button variant="gold" size="sm" onClick={()=>requestAuth(true)}>회원가입</Button><Button variant="goldOutline" size="sm" onClick={()=>requestAuth(false)}>로그인</Button></div>}</div>{role==='buyer'&&<MyActivity user={user} posts={posts} onOrders={()=>onPanel('orders')}/>}<AdminToggle user={user} role={role}/>{role==='buyer'&&user&&<MembershipCard onWallet={()=>onPanel('wallet')}/>}{role==='buyer'&&<TierBenefits/>}
 {role==='seller'?<div className="account-destination"><Store className="text-primary"/><div><h2>Your studio, at a glance.</h2><p>Products, orders and earnings.</p></div><Button asChild variant="gold"><Link to="/seller" search={{role}}>Open dashboard<ArrowRight/></Link></Button></div>:role==='admin'?<div className="account-destination"><ShieldCheck className="text-primary"/><div><h2>Platform management</h2><p>Review, verify and oversee.</p></div><Button asChild variant="gold"><Link to="/admin" search={{role}}>Open back office<ArrowRight/></Link></Button></div>:<><div className="account-shortcuts"><Button variant="ghost" onClick={()=>onPanel('orders')}><Package/><strong>{p.orders.length}</strong><span>Orders</span></Button><Button variant="ghost" onClick={()=>document.getElementById('saved-collection')?.scrollIntoView({behavior:'smooth'})}><Heart/><strong>{saved.length}</strong><span>Saved items</span></Button><Button variant="ghost" onClick={()=>onPanel('settings')}><Settings/><strong>Profile</strong><span>Settings</span></Button></div><div className="seller-apply-band"><div><span className="lux-eyebrow">FOR INDEPENDENT STUDIOS</span><h2>Bring your craft to Vela.</h2><p>Join a considered community of sellers.</p></div><Button variant="goldOutline" onClick={()=>onPanel('apply')}>{acct.data?.application?.status==='approved'?'Seller approved':acct.data?.application?'Application pending':'Apply for Seller Account'}<ArrowRight/></Button></div></>}
 </div>;
}
const sellerTabs=[['overview','Overview',TrendingUp],['orders','Orders & QC',Truck],['tier','Studio Tier',BadgeCheck]] as const;
function StudioHeader({user,role}:{user:AuthUser|null;role:string}){
 const rep=useStudioReputation(user?.id);const n=useNotifications(user);const r=rep.data?.reputation;const tier=r?sellerTier(r)??'standard':'standard';const avg=r?ratingAverage(r):null;const alert=r?ratingDowngradeAlert(r):null;
 return <><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 my-3"><div className="seller-flow-card"><StudioTierBadge tier={tier}/><small className="mt-1 block text-muted-foreground">{studioNames[tier]}</small></div><div className="seller-flow-card"><Star size={16} className="text-primary"/><strong className="mt-1 block text-lg">{avg===null?'—':avg.toFixed(2)}</strong><small className="text-muted-foreground">평균 평점 · 리뷰 {rep.data?.stats.count??0}개</small></div><div className="seller-flow-card"><DollarSign size={16} className="text-primary"/><strong className="mt-1 block text-lg">{r?formatMoney(r.volumeUsd??0):'—'}</strong><small className="text-muted-foreground">누적 매출</small></div><Link to="/seller" search={{role,notice:true}} className="seller-flow-card relative" aria-label={`알림함 · 읽지 않음 ${n.unread}개`}><Bell size={16} className="text-primary"/><strong className="mt-1 block text-lg">{n.unread}</strong><small className="text-muted-foreground">읽지 않은 메시지</small>{n.unread>0&&<span className="absolute right-2 top-2 rounded-full bg-destructive px-2 text-xs text-destructive-foreground">{n.unread>99?'99+':n.unread}</span>}</Link></div>
 {alert&&<div role="alert" className="sample-notice flex items-start gap-2 border-destructive text-destructive"><AlertTriangle size={18} className="shrink-0"/><span>평균 평점 {alert.average.toFixed(2)}점이 {studioNames[alert.tier]} 기준({alert.required.toFixed(1)})보다 낮아 {studioNames[alert.fallback]}(으)로 하향되었습니다. 평점을 올리면 자동으로 복구됩니다.</span></div>}</>;
}
function StudioTierTab(){
 const auth=useQuery({queryKey:['auth-user'],queryFn:async()=>(await supabase.auth.getUser()).data.user});
 const acct=useMyAccount(auth.data??null);const isSeller=!!acct.data?.roles?.includes('seller');
 const live=useStudioReputation(isSeller?auth.data?.id:null);
 return <>{!isSeller&&<div className="sample-notice mt-4">샘플 스튜디오 등급입니다 · 승인된 판매자로 로그인하면 실제 주문 기반 등급이 표시됩니다.</div>}<StudioTierPanel reputation={isSeller&&live.data?live.data.reputation:studioReputation} live={isSeller&&!!live.data} stats={isSeller?live.data?.stats:undefined} recent={isSeller?live.data?.recent:undefined}/></>;
}
export function Dashboard({kind,posts}:{kind:'admin'|'seller';posts:LuxuryPost[]}){
 const search=marketSearch.parse(useRouterState({select:s=>s.location.search}));
 const auth=useQuery({queryKey:['auth-user'],queryFn:async()=>(await supabase.auth.getUser()).data.user});const acct=useMyAccount(auth.data??null);const trustedSeller=!!acct.data?.roles.includes('seller');
 const role=search.role==='admin'?'admin':kind==='seller'&&trustedSeller?'seller':search.role || 'buyer';
 if(kind==='seller'&&(auth.isLoading||(auth.data&&acct.isLoading)))return <div className="lux-empty">Loading…</div>;
 if((kind==='admin'&&role!=='admin')||(kind==='seller'&&role!=='seller'&&role!=='admin'))return <div className="dashboard-gate"><ShieldCheck size={34}/><h1>{kind==='admin'?'Platform back office':'Seller studio'}</h1><p>승인된 계정으로 로그인하면 이용할 수 있습니다.</p></div>;
 if(kind==='admin')return <AdminDashboard posts={posts}/>;
 const tabs=sellerTabs;const section=search.section || 'overview';
 return <div className="dashboard"><div className="dashboard-heading"><div><span className="lux-eyebrow">VS WATCH STUDIO</span><h1>Studio dashboard</h1><p>Every detail of your business, in one place.</p></div><Button asChild variant="goldOutline"><Link to="/store" search={{role}}>View store<ArrowRight/></Link></Button></div><nav className="dashboard-tabs">{tabs.map(([s,label,Icon])=><Button asChild variant="ghost" key={s} className={section===s?'active':''}><Link to="/seller" search={{role,section:s}} resetScroll={false}><Icon/>{label}</Link></Button>)}</nav><StudioHeader user={auth.data??null} role={role}/>
 {section==='tier'?<StudioTierTab/>:section==='orders'?<><div className="section-heading"><h2>주문 · 제작 현황 · QC 검수</h2><span>단계 업데이트 및 검수 사진/영상 업로드</span></div><LiveOrderBoard as="seller"/></>:<><div className="studio-tools"><Button asChild variant="gold"><Link to="/upload" search={{role}}><Plus/>상품 등록 (영상 1 + 사진 9)</Link></Button><Button asChild variant="goldOutline"><Link to="/upload" search={{role}}><Video/>숏폼 영상 편집기</Link></Button></div><SellerStats/></>}
 </div>;
}
