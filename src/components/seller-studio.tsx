import { useEffect, useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import { AlertTriangle, BadgeCheck, Pencil, X } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './ui/button';
import { useMyAccount } from './seller-account';
import { StudioTierBadge, StudioTierPanel } from './reputation';
import { ReviewList } from './customer-reviews';
import { SellerReplacementCenter } from './seller-replacement-center';
import { useAvatarUrl } from '@/lib/avatar';
import { useStudioReputation } from '@/lib/studio-tier';
import { useSellerWorkflows } from '@/lib/use-seller-workflows';
import { completedOrders, salesTrend, type SalesPeriod } from '@/lib/seller-workflows';
import { ratingAverage, ratingDowngradeAlert, sellerTier, studioNames } from '@/lib/reputation';
import { marketSearch } from '@/lib/market';
import { formatMoney } from '@/lib/currency';

export function SellerStudio({ user }: { user: User }) {
 const search=marketSearch.parse(useRouterState({select:s=>s.location.search})),navigate=useNavigate();
 const account=useMyAccount(user),isSeller=!!account.data?.roles.includes('seller'),avatar=useAvatarUrl(account.data?.profile?.avatar_url);
 const performance=useStudioReputation(isSeller?user.id:null),workflows=useSellerWorkflows(user.id);
 const reputation=performance.data?.reputation,tier=reputation?sellerTier(reputation)??'standard':'standard',average=reputation?ratingAverage(reputation):null,alert=reputation?ratingDowngradeAlert(reputation):null;
 const [today,setToday]=useState('');useEffect(()=>setToday(new Date().toISOString().slice(0,10)),[]);
 const period:SalesPeriod=search.salesPeriod??'daily',trend=today?salesTrend(workflows.data?.orders??[],period,search.salesDate??today):[],done=completedOrders(workflows.data?.orders??[]),total=trend.reduce((s,b)=>s+b.total,0);
 return <div className="seller-studio" lang="ko" data-no-translate>
 <header><div className="studio-title-row"><div><span className="lux-eyebrow">셀러 운영 현황</span><h1>내 스튜디오</h1></div><Button asChild variant="goldOutline" size="sm"><Link to="/seller" search={prev=>({...prev,panel:'settings'})} resetScroll={false}><Pencil className="size-4"/>프로필 편집</Link></Button></div>
 <div className="studio-identity"><div className="studio-avatar">{avatar?<img src={avatar} alt="스튜디오 프로필"/>:<span>V</span>}</div><div className="min-w-0"><div className="studio-name-line"><h2>{account.data?.profile?.nickname??'VELA 스튜디오'}</h2>{isSeller&&<StudioTierBadge tier={tier}/>}</div><p className="studio-system-id">#{account.data?.profile?.system_code??'—'}</p><span className="studio-account-label"><BadgeCheck size={13}/>{isSeller?'승인된 셀러':'관리자'}</span></div></div>
 <dl className="studio-profile-stats"><div><dt>누적 매출 ($)</dt><dd>{reputation?formatMoney(reputation.volumeUsd??0,'USD'):'—'}</dd></div><div><dt>평균 평점</dt><dd><span className="text-primary">★</span> {average===null?'—':average.toFixed(2)}</dd></div><div><dt><Link to="/seller" search={prev=>({...prev,studioDialog:'reviews'})} className="text-primary">구매 고객 리뷰</Link></dt><dd>{performance.data?performance.data.stats.count:'—'}<small>개</small></dd></div></dl></header>
 {alert&&<div role="alert" className="studio-rating-alert"><AlertTriangle size={18}/><p>평점 {alert.average.toFixed(2)}점 · {studioNames[alert.tier]} 기준 미달로 {studioNames[alert.fallback]} 적용 중</p></div>}
 <section className="seller-section"><div className="flex flex-wrap items-center justify-between gap-3"><h2>매출 분석</h2><div className="flex gap-1" role="group" aria-label="매출 기간">{([['daily','일별'],['monthly','월별'],['yearly','연별']] as const).map(([id,label])=><Button asChild key={id} size="sm" variant={period===id?'goldOutline':'ghost'}><Link to="/seller" search={prev=>({...prev,salesPeriod:id})} resetScroll={false}>{label}</Link></Button>)}</div></div><div className="flex flex-wrap items-center justify-between gap-3"><strong className="seller-sales-total">{workflows.data?formatMoney(total,'USD'):'—'}</strong><input type="date" aria-label="매출 기준일" className="form-input max-w-44" value={search.salesDate??today} onChange={e=>{if(e.target.value)void navigate({to:'/seller',search:prev=>({...prev,salesDate:e.target.value}),resetScroll:false});}}/></div>
 {workflows.isError?<p role="alert" className="text-destructive">매출 정보를 불러오지 못했습니다.</p>:<div className="seller-sales-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{top:15,right:12,left:0,bottom:5}}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="label" minTickGap={35} stroke="var(--muted-foreground)" fontSize={11}/><YAxis width={52} stroke="var(--muted-foreground)" fontSize={11}/><Tooltip formatter={(value:number)=>[formatMoney(value,'USD'),'매출']}/><Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>}<p className="text-xs text-muted-foreground">구매 확정 주문 · 환불 차감 · UTC 기준 {period==='daily'?'최근 30일':period==='monthly'?'최근 12개월':'최근 5년'}</p></section>
 <section className="seller-section"><h2>주문 및 에스크로</h2><div className="seller-finance-grid"><Button asChild variant="ghost" className="seller-finance-item"><Link to="/seller" search={prev=>({...prev,studioDialog:'history'})}><span>완료 주문 수</span><strong>{workflows.data?done.length:'—'}<small>건</small></strong><span className="text-primary text-xs">전체 판매 내역 →</span></Link></Button><div className="seller-finance-item"><span>입금 완료 총액</span><strong>{workflows.data?formatMoney(workflows.data.escrow.released,'USD'):'—'}</strong></div><div className="seller-finance-item"><span>입금 대기 총액</span><strong>{workflows.data?formatMoney(workflows.data.escrow.pending,'USD'):'—'}</strong></div></div><p className="mt-3 text-xs text-muted-foreground">입금 완료: 에스크로 해제 기록 · 입금 대기: 보관 중인 확인된 결제</p></section>
 <section className="seller-section"><h2>스튜디오 등급 현황</h2>{performance.isError?<p role="alert">등급 정보를 불러오지 못했습니다.</p>:reputation?<StudioTierPanel reputation={reputation} live stats={performance.data?.stats} recent={performance.data?.recent}/>:<p className="seller-empty">{isSeller?'등급 정보를 불러오는 중…':'셀러 실적은 승인된 셀러 계정에서 확인할 수 있습니다.'}</p>}</section>
 <SellerReplacementCenter user={user}/>
 {search.studioDialog&&<Dialog.Root open onOpenChange={open=>{if(!open)void navigate({to:'/seller',search:prev=>({...prev,studioDialog:undefined}),replace:true,resetScroll:false});}}><Dialog.Portal><Dialog.Overlay className="lux-backdrop overlay-front"/><Dialog.Content className="lux-dialog" aria-describedby={undefined} data-no-translate><div className="flex items-center justify-between"><Dialog.Title className="text-lg font-semibold">{search.studioDialog==='reviews'?'구매 고객 리뷰':'전체 완료 주문'}</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="닫기"><X/></Button></Dialog.Close></div>{search.studioDialog==='reviews'?<ReviewList sellerId={user.id}/>:done.length?done.map(o=><div className="seller-thread-row" key={o.id}><div><strong>{o.title}</strong><small>{o.order_no} · {new Date(o.updated_at).toLocaleDateString('ko-KR')}</small></div><strong>{formatMoney(o.amount_usd,'USD')}</strong></div>):<p className="seller-empty">완료된 주문이 없습니다.</p>}</Dialog.Content></Dialog.Portal></Dialog.Root>}
 </div>;
}
