import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Bookmark, Heart, MessageSquare, Package } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { dollars, type LuxuryPost } from '@/lib/luxury-market';
import { useMarketPreview } from './market-preview';

type Tab = 'orders' | 'qna' | 'likes' | 'saved';
const stageKo: Record<string, string> = { placed: '결제 확인 중', preparing: '상품 준비', qc: 'QC 진행', qc_done: 'QC 확인 대기', qc_requested: '추가 사진 요청', shipping_prep: '발송 준비', shipped: '배송 중', delivered: '배송 완료' };

export function MyActivity({ user, posts, onOrders }: { user: User | null; posts: LuxuryPost[]; onOrders: () => void }) {
  const p = useMarketPreview();
  const [tab, setTab] = useState<Tab>('orders');
  const uid = user?.id;
  const byId = new Map(posts.map(x => [x.id, x]));
  const orders = useQuery({ queryKey: ['my-orders', uid], enabled: !!uid, queryFn: async () => (await supabase.from('orders').select('id,order_no,title,image_url,amount_usd,stage,created_at').eq('buyer_id', uid!).order('created_at', { ascending: false })).data ?? [] });
  const qna = useQuery({ queryKey: ['my-qna', uid], enabled: !!uid, queryFn: async () => (await supabase.from('comments').select('id,post_id,body,created_at').eq('user_id', uid!).order('created_at', { ascending: false })).data ?? [] });
  const likes = useQuery({ queryKey: ['my-likes', uid], enabled: !!uid, queryFn: async () => (await supabase.from('likes').select('post_id').eq('user_id', uid!)).data ?? [] });
  const saved = posts.filter(x => p.saved.includes(x.id));
  const liked = (likes.data ?? []).map(l => byId.get(l.post_id)).filter(Boolean) as LuxuryPost[];
  const tabs: [Tab, string, typeof Package, number][] = [['orders', '구매 현황', Package, orders.data?.length ?? 0], ['qna', 'Q&A', MessageSquare, qna.data?.length ?? 0], ['likes', '좋아요', Heart, liked.length], ['saved', '저장', Bookmark, saved.length]];
  const grid = (list: LuxuryPost[], empty: string) => list.length ? <div className="saved-grid">{list.map(post => <Link key={post.id} to="/me" search={{ post: post.id }}><img src={post.images[0]} width={512} height={512} alt={post.title} /><h3>{post.title}</h3><p>{dollars(post.price ?? 0)}</p></Link>)}</div> : <p className="saved-empty">{empty}</p>;
  return <section id="saved-collection" className="mt-1">
    <div className="section-heading"><h2>내 활동</h2></div>
    <div className="grid grid-cols-4 gap-1 mb-4" role="tablist">{tabs.map(([k, label, Icon, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-1 rounded-md border py-2 text-xs ${tab === k ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}><Icon size={18} /><span>{label}</span><strong>{n}</strong></button>)}</div>
    {!user && tab !== 'saved' ? <p className="saved-empty">로그인하면 확인할 수 있어요.</p> :
      tab === 'orders' ? <div className="space-y-2">{[...(orders.data ?? []).map(o => ({ id: o.id, title: o.title, img: o.image_url, amt: Number(o.amount_usd), stage: stageKo[o.stage] ?? o.stage, no: o.order_no }))].map(o => <button key={o.id} onClick={onOrders} className="flex w-full items-center gap-3 rounded-md border border-border p-2 text-left">{o.img && <img src={o.img} alt="" className="size-12 rounded object-cover" />}<div className="min-w-0 flex-1"><p className="truncate text-sm">{o.title}</p><p className="text-xs text-muted-foreground" data-no-translate>{o.no} · {dollars(o.amt)}</p></div><span className="text-xs text-primary">{o.stage}</span></button>)}{!(orders.data?.length || p.orders.length) && <p className="saved-empty">구매한 제품이 없습니다.</p>}</div>
      : tab === 'qna' ? <div className="space-y-2">{(qna.data ?? []).map(c => { const post = byId.get(c.post_id); return <Link key={c.id} to="/me" search={{ post: c.post_id, detailTab: 'qna' }} className="block rounded-md border border-border p-3"><p className="text-xs text-primary truncate">{post?.title ?? '상품'}</p><p className="text-sm">{c.body}</p><p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p></Link>; })}{!qna.data?.length && <p className="saved-empty">작성한 Q&A가 없습니다.</p>}</div>
      : tab === 'likes' ? grid(liked, '좋아요한 상품이 없습니다.') : grid(saved, '저장한 상품이 없습니다.')}
  </section>;
}
