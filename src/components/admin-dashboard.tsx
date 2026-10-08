import { useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bitcoin, Check, FileCheck, ShieldCheck, Store, TrendingUp, Users, Wallet, X, Scale } from 'lucide-react';
import { Button } from './ui/button';
import { AdminApplications } from './seller-account';
import { ReviewList } from './customer-reviews';
import { AdminCryptoOrders, AdminDisputeRooms } from './live-orders';
import { useMarketPreview } from './market-preview';
import { marketSearch } from '@/lib/market';
import { AdminLoyalty } from './loyalty';
import { AdminCatalog, type CatalogSection } from './admin-catalog';
import type { LuxuryPost } from '@/lib/luxury-market';
import { sellerIdentity } from '@/lib/seller-directory';
import { supabase } from '@/integrations/supabase/client';

const tabs = [
  ['sellers', '판매자 승인', Users],
  ['crypto', '가상화폐 주문 검증', Bitcoin],
  ['settlements', '에스크로 정산', Wallet],
  ['disputes', '분쟁 중재', Scale],
  ['moderation', '피드 & 리뷰 관리', FileCheck],
] as const;
const mainTabs = [['dashboard','Dashboard'],['stores','Stores'],['products','Products'],['categories','Categories'],['inventory','Inventory'],['orders','Orders'],['loyalty','Loyalty / Points'],['settings','Settings']] as const;
const legacyKeys = ['sellers','verification','crypto','settlements','disputes','moderation'];
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export function AdminDashboard({ posts }: { posts: LuxuryPost[] }) {
  const search = marketSearch.parse(useRouterState({ select: s => s.location.search }));
  const top = !search.section ? 'dashboard' : legacyKeys.includes(search.section) ? 'settings' : search.section;
  const nav = <nav className="dashboard-tabs flex-wrap" aria-label="관리자 메뉴">{mainTabs.map(([key, label]) => <Button asChild variant="ghost" key={key} className={top === key ? 'active' : ''}><Link to="/admin" search={{ role: 'admin', section: key === 'settings' ? 'sellers' : key }} resetScroll={false}>{label}</Link></Button>)}</nav>;
  if (top === 'loyalty') return <div className="dashboard admin-core"><div className="dashboard-heading"><div><span className="lux-eyebrow">VELA CONTROL CENTER</span><h1>Loyalty / Points</h1><p>VELA Point 발행·사용·예산 관리</p></div></div>{nav}<AdminLoyalty/></div>;
  if (top !== 'settings') return <div className="dashboard admin-core"><div className="dashboard-heading"><div><span className="lux-eyebrow">VELA CONTROL CENTER</span><h1>관리자 백오피스</h1><p>Seller → Store → Product 카탈로그 관리</p></div></div>{nav}<AdminCatalog section={top as CatalogSection} edit={search.edit}/></div>;
  return <div className="dashboard admin-core"><div className="dashboard-heading"><div><span className="lux-eyebrow">VELA CONTROL CENTER</span><h1>관리자 백오피스</h1></div></div>{nav}<LegacyAdmin posts={posts}/></div>;
}

function LegacyAdmin({ posts }: { posts: LuxuryPost[] }) {
  const search = marketSearch.parse(useRouterState({ select: s => s.location.search }));
  const p = useMarketPreview();
  const section = search.section === 'verification' ? 'crypto' : tabs.some(t => t[0] === search.section) ? search.section : 'sellers';
  const [message, setMessage] = useState('');
  const [reviewTab, setReviewTab] = useState(false);
  const { data: reviewCount } = useQuery({ queryKey: ['admin-review-count'], queryFn: async () => { const { count, error } = await supabase.from('reviews').select('id', { count: 'exact', head: true }); if (error) throw error; return count ?? 0; } });
  const listings = posts;
  const studios = new Set(listings.map(sellerIdentity)).size;
  const held = p.orders.filter(o => !o.released);
  const decide = (id: string, state: string) => { p.decide(id, state); setMessage(`${state} · 샘플 상태만 변경되었습니다.`); };
  return <div>
    <div className="sample-notice">판매자 신청은 실제 계정으로 처리합니다. 주문·정산·분쟁은 샘플이며, 실제 블록체인 검증이나 송금은 실행되지 않습니다.</div>
    <div className="dashboard-stats">{[
      ['총 거래량 (USD 환산)', usd(p.orders.reduce((sum, o) => sum + o.amount, 0)), TrendingUp, '샘플 주문 합계'],
      ['활동 스튜디오', String(studios), Store, '쇼케이스 포함 · 게시 상품 보유'],
      ['검증 대기 TXID', '—', Bitcoin, '실제 TXID 수신 미연결'],
      ['에스크로 잔액 (USD 환산)', usd(held.reduce((sum, o) => sum + o.amount, 0)), Wallet, '샘플 보관액 · 실제 잔액 아님'],
    ].map(([label, value, Icon, note]) => { const I = Icon as typeof Store; return <div className="stat-item" key={String(label)}><I size={18}/><span>{String(label)}</span><strong>{String(value)}</strong><small>{String(note)}</small></div>; })}</div>
    <nav className="dashboard-tabs flex-wrap" aria-label="관리자 관리 메뉴">{tabs.map(([key, label, Icon]) => <Button asChild variant="ghost" key={key} className={section === key ? 'active' : ''}><Link to="/admin" search={{ role: 'admin', section: key }} resetScroll={false}><Icon/>{label}</Link></Button>)}</nav>
    {message && <div role="status" className="dashboard-message"><Check size={15}/>{message}</div>}
    {section === 'sellers' ? <>
      <div className="section-heading"><h2>신규 판매자 신청</h2><span>시스템 ID · 닉네임만 확인</span></div><AdminApplications/>
          </> : section === 'crypto' ? <>
      <div className="section-heading"><h2>구매자 TXID 검증</h2><span>USDT TRC-20 / ERC-20 · BTC · ETH</span></div>
      <AdminCryptoOrders/><div className="section-heading mt-8"><h2>샘플 주문</h2><span>미리보기 전용</span></div>
      <div className="management-list">{held.map(o => <div className="management-row" key={o.id}><div><strong>{o.title}</strong><small>{o.id} · {o.sellerName} · 샘플 주문</small><small>TXID / 네트워크 / 입금 확인: 미연결</small></div><strong>{usd(o.amount)}</strong><Button variant="goldOutline" size="sm" disabled><ShieldCheck/>검증 자료 없음</Button></div>)}</div>
    </> : section === 'settlements' ? <>
      <div className="section-heading"><h2>구매 확정 후 가상화폐 정산</h2><span>USDT · BTC · ETH</span></div>
      <div className="management-list">{p.orders.map(o => <div className="management-row" key={o.id}><Wallet className="text-primary"/><div><strong>{o.title}</strong><small>{o.id} · {o.sellerName}</small><small>정산 네트워크 / 판매자 지갑: 미등록</small></div><strong>{usd(o.amount)}</strong><span className="record-status">{o.stage !== 'delivered' ? '구매 확정 대기' : o.released ? '샘플 정산 완료' : '구매 확정됨'}</span><Button variant="goldOutline" size="sm" disabled>송금 미연결</Button></div>)}</div>
    </> : section === 'disputes' ? <>
      <div className="section-heading"><h2>환불 · 불량 신고 · 에스크로 보류</h2><span>샘플 주문 중재</span></div>
      <AdminDisputeRooms/><div className="section-heading mt-8"><h2>샘플 주문</h2><span>미리보기 전용</span></div>
      <div className="management-list">{held.map(o => <div className="management-row" key={o.id}><div><strong>{o.title}</strong><small>{o.id} · {o.sellerName} · {usd(o.amount)} · 샘플</small>{o.request && <small>추가 검수 요청: {o.request.note}</small>}</div><span className="record-status">{p.audits[`dispute:${o.id}`] ?? '분쟁 미접수'}</span><div className="record-actions"><Button variant="goldOutline" size="sm" onClick={() => decide(`dispute:${o.id}`, '샘플 에스크로 보류')}>보류 시뮬레이션</Button><Button variant="ghost" size="sm" disabled={p.audits[`dispute:${o.id}`] !== '샘플 에스크로 보류'} onClick={() => decide(`dispute:${o.id}`, '샘플 보류 해제')}>보류 해제</Button></div></div>)}</div>
    </> : <>
      <div className="section-heading"><h2>상품 영상 & 고객 리뷰</h2><span>실제 삭제 권한과 샘플 숨김 구분</span></div>
      <div className="flex gap-2 border-b border-border py-3"><Button variant={reviewTab ? 'ghost' : 'goldOutline'} onClick={() => setReviewTab(false)}><FileCheck/>상품 · 영상</Button><Button variant={reviewTab ? 'goldOutline' : 'ghost'} onClick={() => setReviewTab(true)}>고객 리뷰 {reviewCount ?? '—'}</Button></div>
      {reviewTab ? <><p className="mt-4 text-xs text-muted-foreground">실제 리뷰 열람 · 주문 연결 검증 및 관리자 삭제는 미연결</p><ReviewList role="admin"/></> : <div className="management-list">{listings.filter(post => !p.hidden.includes(post.id)).map(post => <div className="management-row" key={post.id}><img src={post.images[0]} width={58} height={58} alt=""/><div><strong>{post.title}</strong><small>{post.creator} · {post.short ? '상품 영상' : '상품 사진'} · {post.sample ? '샘플' : '실제 게시물'}</small></div><div className="record-actions"><Button asChild variant="ghost" size="sm"><Link to="/admin" search={{ role: 'admin', section: 'moderation', post: post.id }}>상세 보기</Link></Button><Button variant="destructive" size="sm" onClick={() => { p.hide(post.id); setMessage('현재 미리보기에서만 숨겼습니다. 실제 게시물은 삭제되지 않습니다.'); }}><X/>미리보기 숨김</Button></div></div>)}</div>}
    </>}
  </div>;
}
