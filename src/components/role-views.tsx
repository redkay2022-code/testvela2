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
import { BuyerBadge, StudioTierPanel } from './reputation';
import { studioReputation } from '@/lib/reputation';
import { useStudioReputation } from '@/lib/studio-tier';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TierBenefits } from './insurance';
import { MembershipCard } from './loyalty';
import { MyActivity } from './my-activity';

export function RoleSwitcher(){
 const location=useRouterState({select:s=>s.location}),search=marketSearch.parse(location.search),navigate=useNavigate();
 return <div className="role-switch" aria-label="Sample account role">{[['buyer','Buyer'],['seller','Seller'],['admin','Super Admin']].map(([role,label])=><Button key={role} variant="ghost" aria-pressed={(search.role || 'buyer')===role} className={(search.role || 'buyer')===role?'active':''} onClick={()=>void navigate({to:'.',search:prev=>({...prev,role:role as 'buyer'|'seller'|'admin'})})}>{label}</Button>)}</div>;
}
export function AccountView({posts,user,onPanel,requestAuth}:{posts:LuxuryPost[];user:AuthUser|null;onPanel:(panel:'orders'|'settings'|'apply'|'wallet')=>void;requestAuth:(signup?:boolean)=>void}){
 const search=marketSearch.parse(useRouterState({select:s=>s.location.search})),p=useMarketPreview();
 const role=search.role || 'buyer';const acct=useMyAccount(user);const avatarUrl=useAvatarUrl(acct.data?.profile?.avatar_url);const saved=posts.filter(post=>p.saved.includes(post.id));
 return <div className="account-page"><div className="account-heading"><span className="lux-eyebrow">YOUR PERSONAL COLLECTION</span><h1>My Vela</h1></div><div className="account-profile"><div className="account-avatar">{avatarUrl?<img src={avatarUrl} alt="프로필 사진" className="size-full rounded-full object-cover"/>:<User size={44}/>}</div><div><div className="account-name-line"><h2><span data-no-translate>{user?(acct.data?.profile?.nickname ?? 'Vela Member'):p.profile.name}</span></h2><BuyerBadge/></div>{user&&acct.data?.profile&&<small className="block text-xs text-muted-foreground" data-no-translate>#{acct.data.profile.system_code}</small>}<span className="text-sm text-muted-foreground">{role==='admin'?'Platform owner':role==='seller'?'Studio account':'Collector account'}</span></div>{user?<Button variant="goldOutline" size="sm" className="ml-auto shrink-0" onClick={()=>onPanel('settings')}><Pencil size={15}/>편집</Button>:<div className="ml-auto flex shrink-0 flex-wrap gap-2" role="group" aria-label="회원 계정"><Button variant="gold" size="sm" onClick={()=>requestAuth(true)}>회원가입</Button><Button variant="goldOutline" size="sm" onClick={()=>requestAuth(false)}>로그인</Button></div>}</div>{role==='buyer'&&<MyActivity user={user} posts={posts} onOrders={()=>onPanel('orders')}/>}<AdminToggle user={user} role={role}/>{role==='buyer'&&user&&<MembershipCard onWallet={()=>onPanel('wallet')}/>}{role==='buyer'&&<TierBenefits/>}
 {role==='seller'?<div className="account-destination"><Store className="text-primary"/><div><h2>Your studio, at a glance.</h2><p>Products, orders and earnings.</p></div><Button asChild variant="gold"><Link to="/seller" search={{role}}>Open dashboard<ArrowRight/></Link></Button></div>:role==='admin'?<div className="account-destination"><ShieldCheck className="text-primary"/><div><h2>Platform management</h2><p>Review, verify and oversee.</p></div><Button asChild variant="gold"><Link to="/admin" search={{role}}>Open back office<ArrowRight/></Link></Button></div>:<><div className="account-shortcuts"><Button variant="ghost" onClick={()=>onPanel('orders')}><Package/><strong>{p.orders.length}</strong><span>Orders</span></Button><Button variant="ghost" onClick={()=>document.getElementById('saved-collection')?.scrollIntoView({behavior:'smooth'})}><Heart/><strong>{saved.length}</strong><span>Saved items</span></Button><Button variant="ghost" onClick={()=>onPanel('settings')}><Settings/><strong>Profile</strong><span>Settings</span></Button></div><div className="seller-apply-band"><div><span className="lux-eyebrow">FOR INDEPENDENT STUDIOS</span><h2>Bring your craft to Vela.</h2><p>Join a considered community of sellers.</p></div><Button variant="goldOutline" onClick={()=>onPanel('apply')}>{acct.data?.application?.status==='approved'?'Seller approved':acct.data?.application?'Application pending':'Apply for Seller Account'}<ArrowRight/></Button></div></>}
 </div>;
}
const sellerTabs=[['overview','Overview',TrendingUp],['orders','Orders & shipping',Truck],['earnings','Payouts & earnings',DollarSign],['tier','등급 및 혜택',BadgeCheck]] as const;
function StudioTierTab(){
 const auth=useQuery({queryKey:['auth-user'],queryFn:async()=>(await supabase.auth.getUser()).data.user});
 const acct=useMyAccount(auth.data??null);const isSeller=!!acct.data?.roles?.includes('seller');
 const live=useStudioReputation(isSeller?auth.data?.id:null);
 return <>{!isSeller&&<div className="sample-notice mt-4">샘플 스튜디오 등급입니다 · 승인된 판매자로 로그인하면 실제 주문 기반 등급이 표시됩니다.</div>}<StudioTierPanel reputation={isSeller&&live.data?live.data.reputation:studioReputation} live={isSeller&&!!live.data} stats={isSeller?live.data?.stats:undefined} recent={isSeller?live.data?.recent:undefined}/></>;
}
export function Dashboard({kind,posts}:{kind:'admin'|'seller';posts:LuxuryPost[]}){
 const search=marketSearch.parse(useRouterState({select:s=>s.location.search})); const p=useMarketPreview();const [message,setMessage]=useState('');
 const role=search.role || 'buyer';if((kind==='admin'&&role!=='admin')||(kind==='seller'&&role!=='seller'&&role!=='admin'))return <div className="dashboard-gate"><ShieldCheck size={34}/><h1>{kind==='admin'?'Platform back office':'Seller studio'}</h1><p>승인된 계정으로 로그인하면 이용할 수 있습니다.</p></div>;
 if(kind==='admin')return <AdminDashboard posts={posts}/>;
 const tabs=sellerTabs;const section=search.section || 'overview';
 const decide=(id:string,state:string)=>{p.decide(id,state);setMessage(`${state} · Sample record updated`);};
 return <div className="dashboard"><div className="dashboard-heading"><div><span className="lux-eyebrow">VS WATCH STUDIO</span><h1>Studio dashboard</h1><p>Every detail of your business, in one place.</p></div><Button asChild variant="goldOutline"><Link to="/store" search={{role}}>View store<ArrowRight/></Link></Button></div><div className="dashboard-stats">{([['Revenue','—',TrendingUp],['Orders','—',Package],['Awaiting shipment','—',Truck],['Available payout','—',DollarSign]]).map(([label,value,Icon])=>{const I=Icon as typeof Store;return <div className="stat-item" key={String(label)}><I size={18}/><span>{String(label)}</span><strong>{String(value)}</strong><small>No data yet</small></div>;})}</div><nav className="dashboard-tabs">{tabs.map(([s,label,Icon])=><Button asChild variant="ghost" key={s} className={section===s?'active':''}><Link to="/seller" search={{role,section:s}} resetScroll={false}><Icon/>{label}</Link></Button>)}</nav>{message&&<div role="status" className="dashboard-message"><Check size={15}/>{message}</div>}
 {section==='tier'?<StudioTierTab/>:section==='orders'?<><div className="section-heading"><h2>Escrow order timeline</h2><span>QC upload & shipping</span></div><SellerOrderControl/></>:section==='earnings'?<><div className="section-heading"><h2>Earnings & payout</h2><span>October 2026 · Sample analytics</span></div><Earnings/><div className="finance-summary"><div><span>Total sales</span><strong>$8,420.00</strong></div><div><span>Commission (sample 10%)</span><strong>$842.00</strong></div><div><span>Net earnings</span><strong>$7,578.00</strong></div></div><div className="payout-row"><div><h3>Available balance</h3><strong className="text-2xl text-primary">$6,310.00</strong></div><Button variant="gold" onClick={()=>{decide('payout-request','Requested');}} disabled={p.audits['payout-request']==='Requested'}>{p.audits['payout-request']==='Requested'?'Payout requested':'Request sample payout'}<ArrowRight/></Button></div></>:<><div className="studio-tools"><Button asChild variant="gold"><Link to="/upload" search={{role}}><Plus/>Add New Product</Link></Button><Button asChild variant="goldOutline"><Link to="/upload" search={{role}}><Video/>Add Shorts Video</Link></Button></div><div className="section-heading"><h2>Your collection</h2><span>{posts.length} sample listings</span></div><div className="management-list">{posts.slice(0,6).map(post=><div className="management-row" key={post.id}><img src={post.images[0]} width={58} height={58} alt=""/><div><strong>{post.title}</strong><small>{post.factory} · {post.category}</small></div><strong className="text-primary">{dollars(post.price ?? 0)}</strong><Button asChild variant="ghost" size="icon" aria-label={`View ${post.title}`}><Link to="/seller" search={{role,post:post.id}}><ChevronRight/></Link></Button></div>)}</div></>}
 </div>;
}
function Earnings(){return <div className="earnings-chart"><div className="flex justify-between"><h3>Weekly revenue</h3><span className="text-xs text-primary">+18.6% · Sample</span></div><div className="chart-bars">{[45,68,54,88].map((height,i)=><div key={i}><div className={`chart-bar bar-${height}`}/><span>Week {i+1}</span></div>)}</div></div>;}
