import { AdminDashboard } from './admin-dashboard';
import { AdminToggle, useMyAccount } from './seller-account';
import { useAvatarUrl } from '@/lib/avatar';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { ArrowRight, Heart, Package, Pencil, Settings, ShieldCheck, Store, User } from 'lucide-react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { type LuxuryPost } from '@/lib/luxury-market';
import { marketSearch } from '@/lib/market';
import { useMarketPreview } from './market-preview';
import { BuyerBadge, StudioTierBadge } from './reputation';
import { accountSellerTier } from '@/lib/seller-approval';
import { useStudioReputation } from '@/lib/studio-tier';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TierBenefits } from './insurance';
import { MembershipCard } from './loyalty';
import { MyActivity } from './my-activity';
import { SellerStudio } from './seller-studio';
import { LogoutItem } from './logout-item';

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
 <LogoutItem/>
 </div>;
}
export function Dashboard({kind,posts}:{kind:'admin'|'seller';posts:LuxuryPost[]}){
 const search=marketSearch.parse(useRouterState({select:s=>s.location.search}));
 const auth=useQuery({queryKey:['auth-user'],queryFn:async()=>(await supabase.auth.getUser()).data.user});
 const acct=useMyAccount(auth.data??null);
 if(kind==='admin')return search.role==='admin'?<AdminDashboard posts={posts}/>:<div className="dashboard-gate"><ShieldCheck/><p>관리자 계정으로 로그인해 주세요.</p></div>;
 if(auth.isLoading||(auth.data&&acct.isLoading))return <div className="lux-empty">계정을 확인하는 중…</div>;
 if(!auth.data||!acct.data?.roles.some(r=>r==='seller'||r==='admin'))return <div className="dashboard-gate"><ShieldCheck size={34}/><h1>셀러 스튜디오</h1><p>승인된 계정으로 로그인하면 이용할 수 있습니다.</p></div>;
 return <SellerStudio user={auth.data}/>;
}
