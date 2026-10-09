import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { Star, Heart, MessageSquare, Package, ArrowRight, Truck, Camera, ShieldCheck, AlertTriangle, Check } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { type LuxuryPost } from '@/lib/luxury-market';
import { formatMoney } from '@/lib/currency';
import { isImmediateDispatch } from '@/lib/dispatch';
import { customerTabs, purchaseMilestones } from '@/lib/customer-dashboard';
import { marketSearch } from '@/lib/market';
import { postMediaRoute } from '@/lib/post-media';
import { useEngagement } from '@/lib/use-engagement';
import { useMarketPreview } from './market-preview';
import { Button } from './ui/button';

export function MyActivity({ user, posts }: { user: User | null; posts: LuxuryPost[]; onOrders?: () => void }) {
  const p = useMarketPreview(), navigate = useNavigate();
  const search = marketSearch.parse(useRouterState({select:s=>s.location.search}));
  const tab = search.customerTab ?? 'saved', uid = user?.id;
  const engagement = useEngagement();
  const orders = useQuery({queryKey:['my-orders',uid],enabled:Boolean(uid),refetchInterval:15000,queryFn:async()=>{
    if(!uid) return [];
    const {data,error}=await supabase.from('orders').select('id,order_no,title,image_url,amount_usd,stage,created_at,payment_verified_at,tracking_number,post_id,cancelled_at').eq('buyer_id',uid).order('created_at',{ascending:false});
    if(error) throw error; return data ?? [];
  }});
  const qna = useQuery({queryKey:['my-qna',uid],enabled:Boolean(uid),queryFn:async()=>{
    if(!uid) return [];
    const {data,error}=await supabase.from('comments').select('id,post_id,body,created_at').eq('user_id',uid).order('created_at',{ascending:false});
    if(error) throw error; return data ?? [];
  }});
  const replies = useQuery({queryKey:['my-qna-replies',uid,qna.data?.map(c=>c.id).join()],enabled:Boolean(uid&&qna.data?.length),refetchInterval:15000,queryFn:async()=>{
    const ids=(qna.data??[]).map(c=>c.id);
    const {data,error}=await supabase.from('comments').select('id,parent_id,created_at').in('parent_id',ids).neq('user_id',uid!);
    if(error) throw error; return data ?? [];
  }});
  const seenKey=`vela-qna-seen-${uid ?? 'guest'}`, [seen,setSeen]=useState<string|null>(null);
  useEffect(()=>{setSeen(localStorage.getItem(seenKey) ?? '1970-01-01');},[seenKey]);
  const latestReply=(replies.data??[]).reduce((m,r)=>r.created_at>m?r.created_at:m,'');
  const unreadReplies=Boolean(seen&&latestReply&&latestReply>seen);
  useEffect(()=>{if(tab==='qna'&&latestReply&&seen!==null&&latestReply>seen){localStorage.setItem(seenKey,latestReply);const t=setTimeout(()=>setSeen(latestReply),4000);return ()=>clearTimeout(t);}},[tab,latestReply,seen,seenKey]);
  const repliedTo=new Set((replies.data??[]).map(r=>r.parent_id));
  const saved=p.saved.flatMap(id=>{const post=posts.find(post=>post.id===id);return post?[post]:[];});
  const liked=posts.filter(post=>engagement.likedIds.has(post.id));
  const counts={saved:saved.length,orders:orders.data?.length ?? 0,qna:qna.data?.length ?? 0,likes:liked.length};
  const labels={saved:'저장한 컬렉션',orders:'구매한 제품 정보',qna:'문의 내역',likes:'좋아요한 게시물'};
  const icons={saved:Star,orders:Package,qna:MessageSquare,likes:Heart};
  const openOrder=(id:string,view:'tracking'|'qc'|'specs'|'defect')=>void navigate({to:'/me',search:prev=>({...prev,panel:'orders',orderId:id,orderView:view}),resetScroll:false});
  const grid=(list:LuxuryPost[])=>list.length?<div className="customer-saved-grid">{list.map(post=><article key={post.id} className="customer-product">
    <div className="customer-product-media"><Link to={postMediaRoute(post)} params={{id:post.id}} aria-label={post.title}><img src={post.images[0]} alt={post.title} loading="lazy" className={post.outOfStock?'grayscale':''}/></Link>{post.outOfStock?<span className="lux-soldout">품절</span>:isImmediateDispatch(post)&&<span className="lux-ready-badge">바로 발송</span>}<Button variant="ghost" size="icon" className="customer-save-toggle" title="저장 해제" aria-label={`저장 해제 ${post.title}`} aria-pressed={p.saved.includes(post.id)} onClick={()=>p.toggleSaved(post.id)}><Star fill={p.saved.includes(post.id)?'currentColor':'none'}/></Button></div>
    <div className="customer-product-copy"><Link to={postMediaRoute(post)} params={{id:post.id}}><h3>{post.title}</h3></Link>{post.price!==null&&<p className="text-primary font-semibold" data-no-translate>{formatMoney(post.price,'USD')} <span className="text-xs text-muted-foreground">≈ {post.price.toLocaleString('en-US')} USDT</span></p>}{post.price!==null?<Button asChild variant="gold" className="w-full mt-3" disabled={post.outOfStock}><Link to={post.outOfStock?'/post/$id':'/buy/$id'} params={{id:post.id}} aria-disabled={post.outOfStock}>{post.outOfStock?'품절':'구매하기'}<ArrowRight/></Link></Button>:<Button asChild variant="goldOutline" className="w-full mt-3"><Link to={postMediaRoute(post)} params={{id:post.id}}>게시물 보기<ArrowRight/></Link></Button>}</div>
  </article>)}</div>:<div className="customer-empty"><Star size={30} className="text-primary"/><h3>{tab==='saved'?'아직 저장한 컬렉션이 없습니다.':'좋아요한 게시물이 없습니다.'}</h3><Button asChild variant="goldOutline"><Link to="/">상품 둘러보기<ArrowRight/></Link></Button></div>;
  return <section id="saved-collection" className="customer-activity" lang="ko" data-no-translate>
    <nav className="customer-tabs" aria-label="내 VELA 활동" role="tablist">{customerTabs.map(key=>{const Icon=icons[key];return <Button key={key} asChild variant="ghost" className={`relative ${tab===key?'active':''}`}><Link to="/me" search={prev=>({...prev,customerTab:key})} role="tab" aria-selected={tab===key} resetScroll={false}><Icon size={18}/><span>{labels[key]}</span><strong>{counts[key]}</strong>{key==='qna'&&unreadReplies&&<span aria-label="새 답변" className="absolute right-1 top-1 size-2.5 rounded-full bg-destructive"/>}</Link></Button>;})}</nav>
    <div className="section-heading"><h2>{labels[tab]}</h2><span>{counts[tab]}개</span></div>
    {!user&&tab!=='saved'?<p className="saved-empty">로그인하면 확인할 수 있습니다.</p>:tab==='saved'?grid(saved):tab==='likes'?grid(liked):tab==='qna'?<div className="space-y-3">{qna.isError?<p role="alert">문의 내역을 불러오지 못했습니다.</p>:qna.isLoading?<p>문의 내역을 불러오는 중…</p>:qna.data?.length?qna.data.map(c=><Link key={c.id} to="/post/$id" params={{id:c.post_id}} search={{detailTab:'qna'}} className="block border-b border-border py-3"><h3 className="text-sm text-primary">{posts.find(post=>post.id===c.post_id)?.title ?? '상품 문의'}</h3><p className="mt-2 text-sm whitespace-pre-wrap">{c.body}</p>{repliedTo.has(c.id)&&<p className="text-xs text-primary">판매자 답변 도착</p>}<time className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('ko-KR')}</time></Link>):<p className="saved-empty">작성한 문의가 없습니다.</p>}</div>:<div className="space-y-4">{orders.isError?<p role="alert">구매 내역을 불러오지 못했습니다.</p>:orders.isLoading?<p>구매 내역을 불러오는 중…</p>:orders.data?.length?orders.data.map(o=><article key={o.id} className="customer-order"><div className="flex gap-3 items-center">{o.image_url&&<img src={o.image_url} alt={o.title} className="size-20 rounded object-cover"/>}<div className="min-w-0"><p className="text-xs text-muted-foreground">{o.order_no}</p><h3 className="text-sm font-semibold my-1">{o.title}</h3><p className="text-primary font-semibold">{formatMoney(Number(o.amount_usd),'USD')}</p></div></div>{o.cancelled_at?<p className="mt-4 text-destructive">취소된 주문</p>:<ol className="customer-timeline" aria-label="주문 진행 상태">{purchaseMilestones(o).map((done,i)=><li key={i} className={done?'complete':''}><span>{done?<Check size={12}/>:i+1}</span><p>{['결제 확인','출고 QC 승인','배송 중','배송 완료'][i]}</p></li>)}</ol>}<div className="customer-order-actions"><Button variant="goldOutline" onClick={()=>openOrder(o.id,'tracking')}><Truck/>배송 추적</Button><Button variant="goldOutline" onClick={()=>openOrder(o.id,'qc')}><Camera/>출고 QC 사진·영상</Button><Button variant="ghost" onClick={()=>openOrder(o.id,'specs')}><ShieldCheck/>보증 안내·제품 스펙</Button><Button variant="ghost" onClick={()=>openOrder(o.id,'defect')}><AlertTriangle/>초기 불량·교환 접수</Button></div></article>):<p className="saved-empty">구매한 제품이 없습니다.</p>}</div>}
  </section>;
}
