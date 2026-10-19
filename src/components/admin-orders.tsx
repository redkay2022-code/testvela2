import { useState } from 'react';
import { Check, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { dollars } from '@/lib/luxury-market';
import { stageLabel, type EscrowStage } from '@/lib/escrow';
import { Button } from './ui/button';
import { explorerUrl, useAdminOrders, type Order } from './live-orders';
import { ListPagination, usePagination } from './list-pagination';

/** 관리자 전용 화면(한국어 고정): 모든 상품 주문 내역 관리. */
const FILTERS = [['all', '전체'], ['wait', '입금 확인 대기'], ['active', '진행 중 (입금 확인됨)'], ['shipped', '배송 중'], ['delivered', '구매 확정'], ['dispute', '분쟁'], ['cancelled', '취소']] as const;
type Filter = typeof FILTERS[number][0];
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function kind(o: Order): Exclude<Filter, 'all'> {
  if (o.cancelled_at) return 'cancelled';
  if (o.dispute_open) return 'dispute';
  if (!o.payment_verified_at) return 'wait';
  if (o.stage === 'delivered') return 'delivered';
  if (o.stage === 'shipped') return 'shipped';
  return 'active';
}
const shipText = (s: Order['shipping']) => s ? [s['recipient'], s['phone'], [s['line1'], s['line2'], s['city'], s['state'], s['postal'], s['country']].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : '';

export function AdminOrdersPanel() {
  const q = useAdminOrders('crypto');
  const [filter, setFilter] = useState<Filter>('all'), [text, setText] = useState(''), [open, setOpen] = useState<string | null>(null);
  const all = q.data?.orders ?? [];
  const count = (f: Filter) => f === 'all' ? all.length : all.filter(o => kind(o) === f).length;
  const sum = (f: Filter) => all.filter(o => f === 'all' || kind(o) === f).reduce((a, o) => a + Number(o.amount_usd), 0);
  const needle = text.trim().toLowerCase();
  const rows = all.filter(o => (filter === 'all' || kind(o) === filter) && (!needle || [o.order_no, o.title, o.seller_name, o.txid ?? '', o.buyer_id, shipText(o.shipping ?? null)].some(v => v.toLowerCase().includes(needle))));
  const pager = usePagination(rows, `${filter}|${needle}`);
  const verify = (o: Order) => { const ex = explorerUrl(o.network, o.txid ?? ''); if (confirm(`${o.txid ? ex.name + '에서 ' : ''}금액과 수신 주소를 확인하셨나요? 결제 확인으로 처리합니다.`)) void supabase.from('orders').update({ payment_verified_at: new Date().toISOString() }).eq('id', o.id).then(r => r.error ? toast.error(r.error.message) : toast.success('결제 확인 처리되었습니다.')); };
  if (q.isLoading) return <p className="mt-4 text-sm text-muted-foreground">주문을 불러오는 중…</p>;
  if (q.error) return <p className="mt-4 text-sm text-muted-foreground">관리자 계정으로 로그인하면 주문을 확인할 수 있습니다.</p>;
  return <div className="mt-4" lang="ko" data-no-translate translate="no">
    <div className="dashboard-stats">{([['전체 주문', 'all'], ['입금 확인 대기', 'wait'], ['진행 중', 'active'], ['구매 확정', 'delivered']] as const).map(([l, f]) => <div className="stat-item" key={f}><span>{l}</span><strong>{count(f)}건</strong><small>{usd(sum(f))}</small></div>)}</div>
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {FILTERS.map(([f, l]) => <Button key={f} size="sm" variant={filter === f ? 'goldOutline' : 'ghost'} aria-pressed={filter === f} onClick={() => setFilter(f)}>{l} {count(f)}</Button>)}
    </div>
    <label className="search-field my-4 flex w-full items-center gap-2"><Search size={16} /><input aria-label="주문 검색" className="min-w-0 flex-1 bg-transparent outline-none" placeholder="주문번호 · 상품 · 셀러 · TXID · 구매자 ID · 수령인 검색" value={text} onChange={e => setText(e.target.value)} /></label>
    {!rows.length ? <p className="py-8 text-center text-sm text-muted-foreground">조건에 맞는 주문이 없습니다.</p> :
    <div className="management-list">{pager.items.map(o => { const k = kind(o), ex = explorerUrl(o.network, o.txid ?? ''), ship = shipText(o.shipping ?? null);
      return <div className="management-row flex-wrap" key={o.id}>
        <div className="min-w-0 flex-1"><strong>{o.title}</strong>
          <small className="block break-all">{o.order_no} · 셀러 {o.seller_name} · 구매자 {o.buyer_id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}</small>
          <small className="block break-all">{o.network ?? '—'} · TXID {o.txid ?? '미제출'} · {stageLabel(o.stage as EscrowStage)}{o.tracking_number ? ` · ${o.courier ?? ''} ${o.tracking_number}` : ''}</small>
          {open === o.id && <div className="mt-2 rounded-md border border-border p-3 text-xs leading-6">
            <p><b>배송지</b> {ship || '입력 없음'}</p>
            <p><b>주문 ID</b> <span className="break-all">{o.id}</span></p>
            <p><b>구매자 ID</b> <span className="break-all">{o.buyer_id}</span></p>
            <p><b>상품 ID</b> <span className="break-all">{o.post_id ?? '—'}</span></p>
            {o.dispute_open && <p className="text-primary">분쟁이 접수된 주문입니다. 분쟁 중재 탭에서 대화에 참여하세요.</p>}
          </div>}
        </div>
        <strong>{dollars(Number(o.amount_usd))}</strong>
        <span className="record-status">{{ wait: '입금 확인 대기', active: '진행 중', shipped: '배송 중', delivered: '구매 확정', dispute: '분쟁 중', cancelled: '취소됨' }[k]}</span>
        <div className="record-actions">
          <Button size="sm" variant="ghost" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? '접기' : '상세'}</Button>
          {o.txid && <Button asChild size="sm" variant="ghost"><a href={ex.url} target="_blank" rel="noreferrer"><ExternalLink />{ex.name}</a></Button>}
          {!o.payment_verified_at && !o.cancelled_at && <Button size="sm" variant="goldOutline" onClick={() => verify(o)}><Check />결제 확인</Button>}
        </div>
      </div>; })}</div>}
    <ListPagination pager={pager} />
  </div>;
}
