import { useEffect, useRef, useState } from 'react';
import { ReviewModal } from './customer-reviews';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertTriangle, Camera, Check, ExternalLink, MapPin, MessageSquareText, RefreshCw, Send, ShieldCheck, Truck, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { dollars } from '@/lib/luxury-market';
import { qcAreas, stageLabel, type EscrowStage } from '@/lib/escrow';
import { getOrderTracking } from '@/lib/tracking.functions';
import { EscrowTimeline } from './escrow';

export const QC_MIN_PHOTOS = 9, QC_MIN_VIDEOS = 1;
const BUCKET = 'qc-media';
type Order = { id: string; order_no: string; buyer_id: string; seller_id: string | null; seller_name: string; title: string; image_url: string | null; amount_usd: number; stage: string; courier: string | null; tracking_number: string | null; created_at: string; network: string | null; txid: string | null; payment_verified_at: string | null; dispute_open: boolean };
type Media = { id: string; order_id: string; path: string; kind: 'image' | 'video'; round: number; url?: string };
type Msg = { id: string; order_id: string; author_role: string; kind: string; body: string; areas: string[]; created_at: string };

export const couriers = ['SF Express', 'EMS', 'DHL Express', 'FedEx', 'UPS', 'CJ Logistics', 'China Post'];
/** Block explorer page for a submitted TXID on its network. */
export function explorerUrl(network: string | null, txid: string) {
  const t = encodeURIComponent(txid.trim());
  if (network === 'USDT-TRC20') return { name: 'Tronscan', url: `https://tronscan.org/#/transaction/${t}` };
  if (network === 'BTC') return { name: 'Mempool', url: `https://mempool.space/tx/${t}` };
  return { name: 'Etherscan', url: `https://etherscan.io/tx/${t.startsWith('0x') ? t : `0x${t}`}` };
}
const courierLink = (c: string | null, n: string) => `https://t.17track.net/en#nums=${encodeURIComponent(n)}`;

/** Creates a persistent order for a signed-in buyer after TXID submission. */
export async function createLiveOrder(input: { post_id: string; title: string; image_url?: string; amount_usd: number; seller_id: string | null; seller_name: string; network: string; txid: string }) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: row, error } = await supabase.from('orders').insert({ ...input, buyer_id: data.user.id }).select('id').single();
  if (error) throw error;
  return row.id;
}

function useLive(userId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['live-orders', userId], enabled: !!userId,
    queryFn: async () => {
      const { data: orders, error } = await supabase.from('orders').select('id,order_no,buyer_id,seller_id,seller_name,title,image_url,amount_usd,stage,courier,tracking_number,created_at,network,txid,payment_verified_at,dispute_open').order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (orders ?? []).map(o => o.id);
      const [m, msgs] = ids.length ? await Promise.all([
        supabase.from('order_qc_media').select('id,order_id,path,kind,round').in('order_id', ids).order('created_at'),
        supabase.from('order_messages').select('id,order_id,author_role,kind,body,areas,created_at').in('order_id', ids).order('created_at'),
      ]) : [{ data: [] }, { data: [] }];
      const media = (m.data ?? []) as Media[];
      if (media.length) { const { data: s } = await supabase.storage.from(BUCKET).createSignedUrls(media.map(x => x.path), 3600); const map = new Map(s?.map(x => [x.path, x.signedUrl])); media.forEach(x => { const u = map.get(x.path); if (u) x.url = u; }); }
      return { orders: (orders ?? []) as Order[], media, msgs: (msgs.data ?? []) as Msg[] };
    },
  });
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`orders-live-${userId}`);
    for (const table of ['orders', 'order_messages', 'order_qc_media']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => void qc.invalidateQueries({ queryKey: ['live-orders', userId] }));
    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, qc]);
  return q;
}

function useUser() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => { void supabase.auth.getUser().then(async ({ data }) => { setUser(data.user); if (data.user) { const { data: r } = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' }); setAdmin(!!r); } }); }, []);
  return { user, admin };
}

function Gallery({ media }: { media: Media[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const cur = open !== null ? media[open] : undefined;
  return <><div className="qc-grid">{media.map((m, i) => <button type="button" key={m.id} onClick={() => setOpen(i)} aria-label={`QC 파일 ${i + 1} 열기`}>{m.kind === 'video' ? <video src={m.url} muted playsInline preload="metadata" /> : <img src={m.url} alt={`QC 사진 ${i + 1}`} />}<span>{i + 1}</span></button>)}</div>
    {cur && <div className="qc-lightbox" role="dialog" aria-label="QC 파일"><Button variant="ghost" size="icon" aria-label="닫기" onClick={() => setOpen(null)}><X /></Button>{cur.kind === 'video' ? <video src={cur.url} controls autoPlay playsInline /> : <img src={cur.url} alt="QC 사진" />}<p>{open! + 1} / {media.length}</p></div>}</>;
}

function Thread({ msgs }: { msgs: Msg[] }) {
  if (!msgs.length) return null;
  return <ul className="mt-3 grid gap-2 text-sm">{msgs.map(m => <li key={m.id} className={`rounded-md border p-2 ${m.author_role === 'admin' ? 'border-primary bg-primary/20' : m.author_role === 'seller' ? 'border-border bg-card' : 'border-border bg-primary/10'}`}>
    <div className="flex justify-between text-xs text-muted-foreground"><span>{m.author_role === 'admin' ? '관리자 (중재)' : m.author_role === 'seller' ? '셀러' : '구매자'} · {m.kind === 'request' ? '추가 사진 요청' : m.kind === 'qc' ? 'QC 업로드' : '메시지'}</span><span>{new Date(m.created_at).toLocaleString()}</span></div>
    {m.areas.length > 0 && <p className="mt-1 text-primary">{m.areas.join(', ')}</p>}
    {m.body && <p className="mt-1 whitespace-pre-wrap">{m.body}</p>}
  </li>)}</ul>;
}

export function Composer({ orderId, role, onSent }: { orderId: string; role: 'buyer' | 'seller' | 'admin'; onSent?: () => void }) {
  const [v, setV] = useState(''); const [busy, setBusy] = useState(false);
  return <form className="ship-form mt-2" onSubmit={async e => { e.preventDefault(); if (!v.trim()) return; setBusy(true); const { data } = await supabase.auth.getUser(); await supabase.from('order_messages').insert({ order_id: orderId, author_id: data.user!.id, author_role: role, body: v.trim().slice(0, 1000) }); setV(''); setBusy(false); onSent?.(); }}>
    <input className="form-input" maxLength={1000} value={v} onChange={e => setV(e.target.value)} placeholder="메시지 남기기" aria-label="메시지" /><Button variant="goldOutline" type="submit" disabled={busy}><Send />보내기</Button></form>;
}

function TrackingPanel({ o }: { o: Order }) {
  const fetchTrack = useServerFn(getOrderTracking);
  const q = useQuery({ queryKey: ['tracking', o.id, o.tracking_number], enabled: !!o.tracking_number, queryFn: () => fetchTrack({ data: { orderId: o.id } }), refetchInterval: 10 * 60 * 1000 });
  if (!o.tracking_number) return null;
  const latest = q.data?.events[0];
  return <div className="tracking-widget"><Truck className="text-primary" />
    <div><span>택배사</span><strong>{o.courier}</strong></div>
    <div><span>송장번호</span><strong data-no-translate>{o.tracking_number}</strong></div>
    <div><span><MapPin size={10} className="inline" /> 현재 상태</span><strong>{latest ? `${latest.description}${latest.location ? ` · ${latest.location}` : ''}` : q.isLoading ? '조회 중…' : (q.data?.status ?? '대기')}</strong></div>
    {q.data?.events && q.data.events.length > 1 && <ol className="col-span-full mt-2 grid gap-1 text-xs text-muted-foreground">{q.data.events.slice(1, 8).map((e, i) => <li key={i}>{e.time ? new Date(e.time).toLocaleString() : ''} · {e.description} {e.location}</li>)}</ol>}
    <small className="col-span-full flex flex-wrap items-center gap-2">
      {q.data && !q.data.configured ? '자동 추적 서비스 연결 대기 중 · ' : q.data?.checkedAt ? `마지막 조회 ${new Date(q.data.checkedAt).toLocaleTimeString()} · ` : ''}
      <a className="text-primary underline" href={courierLink(o.courier, o.tracking_number)} target="_blank" rel="noreferrer">택배사 조회 열기</a>
      {q.data?.configured && <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={() => void fetchTrack({ data: { orderId: o.id, force: true } }).then(() => q.refetch())}><RefreshCw size={11} />새로고침</button>}
      {q.data?.error}
    </small></div>;
}

function QcUploader({ o, round, supplement }: { o: Order; round: number; supplement: boolean }) {
  const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const imgs = files.filter(f => f.type.startsWith('image/')).length, vids = files.filter(f => f.type.startsWith('video/')).length;
  const ok = supplement ? files.length >= 1 : imgs >= QC_MIN_PHOTOS && vids >= QC_MIN_VIDEOS;
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await supabase.auth.getUser(); const uid = data.user!.id;
      for (const f of files) {
        const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${o.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type });
        if (up.error) throw up.error;
        const ins = await supabase.from('order_qc_media').insert({ order_id: o.id, uploader_id: uid, path, kind: f.type.startsWith('video/') ? 'video' : 'image', round });
        if (ins.error) throw ins.error;
      }
      await supabase.from('order_messages').insert({ order_id: o.id, author_id: uid, author_role: 'seller', kind: 'qc', body: `${supplement ? '추가' : 'QC'} 사진 ${imgs}장 · 영상 ${vids}개 업로드` });
      const st = await supabase.from('orders').update({ stage: 'qc_done' }).eq('id', o.id);
      if (st.error) throw st.error;
      setFiles([]);
    } catch (e) { setErr(e instanceof Error ? e.message : '업로드 실패'); } finally { setBusy(false); }
  };
  return <div className="qc-upload"><label className="qc-drop"><Upload size={18} /><span>{supplement ? '요청받은 추가 사진·영상 업로드' : `디테일 사진 ${QC_MIN_PHOTOS}장 이상 + 영상 ${QC_MIN_VIDEOS}개 이상 업로드`}</span>
    <input type="file" accept="image/*,video/*" multiple onChange={e => { const l = e.target.files; if (l) setFiles(prev => [...prev, ...[...l].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))]); e.target.value = ''; }} /></label>
    <p className={`qc-count ${ok ? 'ok' : ''}`}>사진 {imgs}장 · 영상 {vids}개 {supplement ? '' : `(필수: 사진 ${QC_MIN_PHOTOS}+ / 영상 ${QC_MIN_VIDEOS}+)`}</p>
    {files.length > 0 && <ul className="text-xs text-muted-foreground">{files.map((f, i) => <li key={i} className="flex justify-between"><span>{f.name}</span><button type="button" aria-label={`${f.name} 삭제`} onClick={() => setFiles(p => p.filter((_, j) => j !== i))}><X size={12} /></button></li>)}</ul>}
    {err && <p className="text-xs text-destructive">{err}</p>}
    <Button variant="gold" disabled={!ok || busy} onClick={() => void submit()}><Check />{busy ? '업로드 중…' : supplement ? '추가 사진 보내기' : 'QC 완료 & 구매자에게 전송'}</Button></div>;
}

function RequestForm({ o, close }: { o: Order; close: () => void }) {
  const [areas, setAreas] = useState<string[]>([]); const [note, setNote] = useState('');
  return <div className="qc-request"><h3>추가 사진 요청</h3><div className="qc-areas">{qcAreas.map(a => <button type="button" key={a} aria-pressed={areas.includes(a)} className={areas.includes(a) ? 'active' : ''} onClick={() => setAreas(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a])}>{a}</button>)}</div>
    <textarea className="form-input" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="예: 야광을 완전히 어두운 곳에서 보여주세요" aria-label="요청 내용" />
    <div className="escrow-actions"><Button variant="ghost" onClick={close}>취소</Button><Button variant="gold" disabled={!areas.length && !note.trim()} onClick={async () => { const { data } = await supabase.auth.getUser(); await supabase.from('order_messages').insert({ order_id: o.id, author_id: data.user!.id, author_role: 'buyer', kind: 'request', areas, body: note.trim() }); await supabase.from('orders').update({ stage: 'qc_requested' }).eq('id', o.id); close(); }}>요청 보내기</Button></div></div>;
}

function ShipForm({ o }: { o: Order }) {
  const [courier, setCourier] = useState(couriers[0]!); const [num, setNum] = useState(''); const [err, setErr] = useState('');
  return <form className="ship-form" onSubmit={async e => { e.preventDefault(); const r = await supabase.from('orders').update({ courier, tracking_number: num.trim(), stage: 'shipped' }).eq('id', o.id); setErr(r.error?.message ?? ''); }}>
    <select className="form-input" value={courier} onChange={e => setCourier(e.target.value)} aria-label="택배사">{couriers.map(c => <option key={c}>{c}</option>)}</select>
    <input className="form-input" required maxLength={40} pattern="[A-Za-z0-9\-]{6,40}" value={num} onChange={e => setNum(e.target.value)} placeholder="송장번호" aria-label="송장번호" />
    <Button variant="gold" type="submit"><Truck />발송 완료 & 송장 등록</Button>{err && <p className="text-xs text-destructive">{err}</p>}</form>;
}

/** Persistent QC board: seller QC uploads, buyer approval / extra-photo requests, tracking. */
export function LiveOrderBoard({ as }: { as: 'buyer' | 'seller' }) {
  const { user, admin } = useUser();
  const q = useLive(user?.id ?? null);
  const [asking, setAsking] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  if (!user) return null;
  const orders = (q.data?.orders ?? []).filter(o => as === 'buyer' ? o.buyer_id === user.id : (o.seller_id === user.id || (o.seller_id === null && admin)));
  const setStage = (id: string, stage: EscrowStage) => void supabase.from('orders').update({ stage }).eq('id', id);
  return <section className="escrow-board mb-6" aria-label="QC 게시판">
    {reviewing && <ReviewModal orderId={reviewing} close={() => setReviewing(null)} requestAuth={() => setReviewing(null)} />}
    <div className="section-heading"><h2><MessageSquareText size={16} className="mr-1 inline" />QC 게시판</h2><span>실시간 저장</span></div>
    {!orders.length && <p className="py-6 text-center text-sm text-muted-foreground">{as === 'buyer' ? '결제한 실제 주문이 여기에 표시됩니다.' : '받은 실제 주문이 여기에 표시됩니다.'}</p>}
    {orders.map(o => {
      const media = (q.data?.media ?? []).filter(m => m.order_id === o.id);
      const msgs = (q.data?.msgs ?? []).filter(m => m.order_id === o.id);
      const round = media.reduce((r, m) => Math.max(r, m.round), 0);
      const stage = o.stage as EscrowStage;
      const isSeller = as === 'seller';
      return <article className="escrow-order" key={o.id}>
        <div className="escrow-order-head">{o.image_url ? <img src={o.image_url} width={52} height={52} alt="" /> : <Camera className="text-primary" />}<div><span className="lux-eyebrow" data-no-translate>{o.order_no}</span><strong>{o.title}</strong><small>{stageLabel(stage)} · {o.seller_name}</small></div><div className="text-right"><strong>{dollars(Number(o.amount_usd))}</strong></div></div>
        <EscrowTimeline stage={stage} />
        {media.length > 0 && <><h4 className="escrow-sub"><Camera size={14} /> QC 사진·영상 {media.length}개</h4><Gallery media={media} /></>}
        {isSeller && stage === 'placed' && <Button variant="gold" onClick={() => setStage(o.id, 'preparing')}>제품 준비 시작</Button>}
        {isSeller && stage === 'preparing' && <Button variant="gold" onClick={() => setStage(o.id, 'qc')}>QC 검수 시작</Button>}
        {isSeller && stage === 'qc' && <QcUploader o={o} round={1} supplement={false} />}
        {isSeller && stage === 'qc_requested' && <QcUploader o={o} round={round + 1} supplement />}
        {isSeller && stage === 'qc_done' && <p className="escrow-wait">구매자의 QC 확인을 기다리는 중입니다.</p>}
        {isSeller && stage === 'shipping_prep' && <ShipForm o={o} />}
        {!isSeller && stage === 'qc_requested' && <p className="escrow-wait">셀러가 추가 사진을 준비 중입니다.</p>}
        {!isSeller && stage === 'qc_done' && (asking === o.id ? <RequestForm o={o} close={() => setAsking(null)} /> : <div className="escrow-actions"><Button variant="gold" onClick={() => setStage(o.id, 'shipping_prep')}><Check />QC 승인</Button><Button variant="goldOutline" onClick={() => setAsking(o.id)}><Camera />추가 사진 요청</Button></div>)}
        <TrackingPanel o={o} />
        {!isSeller && stage === 'shipped' && <Button variant="gold" className="w-full" onClick={() => setStage(o.id, 'delivered')}><ShieldCheck />수령 확인 및 구매 확정</Button>}
        {!isSeller && stage === 'delivered' && <Button variant="gold" className="w-full" onClick={() => setReviewing(o.id)}><Star />리뷰 작성 및 셀러 평가</Button>}
        {!o.payment_verified_at && <p className="escrow-wait">관리자가 TXID 입금을 확인하는 중입니다.</p>}
        {o.dispute_open && <p className="mt-3 flex items-center gap-2 rounded-md border border-primary p-2 text-sm text-primary"><AlertTriangle size={15} />분쟁 진행 중 · 관리자가 참여한 3자 분쟁방입니다. 에스크로 대금은 중재가 끝날 때까지 보류됩니다.</p>}
        <div className="escrow-actions mt-3">
          <Button variant="goldOutline" onClick={() => setChat(chat === o.id ? null : o.id)}><MessageSquareText />{o.dispute_open ? '분쟁방 열기' : isSeller ? '구매자에게 메시지' : '판매자에게 메시지'}{msgs.length ? ` (${msgs.length})` : ''}</Button>
          {!o.dispute_open && stage !== 'delivered' && <Button variant="ghost" onClick={() => { if (confirm('분쟁을 열면 관리자가 대화에 참여하고 에스크로 대금이 보류됩니다. 계속할까요?')) void supabase.from('orders').update({ dispute_open: true }).eq('id', o.id).then(r => { if (r.error) toast.error(r.error.message); else setChat(o.id); }); }}><AlertTriangle />분쟁 열기</Button>}
        </div>
        {chat === o.id && <div className="mt-2"><p className="text-xs text-muted-foreground">{o.dispute_open ? '구매자 · 셀러 · 관리자 3자 대화' : '익명 1:1 주문 대화 · 닉네임과 연락처는 공유되지 않습니다'}</p><Thread msgs={msgs} /><Composer orderId={o.id} role={as} /></div>}
      </article>;
    })}
  </section>;
}

const stageToast: Record<string, [string, string]> = {
  shipped: ['발송 완료', '송장이 등록되었습니다. 17TRACK 실시간 추적을 확인하세요.'],
  delivered: ['배송 완료', '수령을 확인하고 구매 확정 후 리뷰를 남겨 주세요.'],
  qc_done: ['QC 사진 도착', '셀러가 QC 사진·영상을 보냈습니다. 확인해 주세요.'],
};

/** Global watcher: toasts when a live order's payment or stage changes. Mounted once in the root. */
export function OrderNotifier() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const q = useLive(uid);
  const prev = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const orders = q.data?.orders; if (!orders) return;
    const next = new Map(orders.map(o => [o.id, `${o.stage}|${o.payment_verified_at ? 1 : 0}|${o.dispute_open ? 1 : 0}`]));
    const before = prev.current; prev.current = next;
    if (!before) return;
    for (const o of orders) {
      const old = before.get(o.id); if (!old || old === next.get(o.id)) continue;
      const [os, op, od] = old.split('|');
      if (op === '0' && o.payment_verified_at) toast.success(`결제 확인 완료 · ${o.order_no}`, { description: `${o.title} — 입금이 확인되어 에스크로에 보관됩니다.` });
      if (os !== o.stage && stageToast[o.stage]) { const [t, d] = stageToast[o.stage]!; toast.success(`${t} · ${o.order_no}`, { description: `${o.title} — ${d}${o.stage === 'shipped' && o.tracking_number ? ` (${o.courier} ${o.tracking_number})` : ''}` }); }
      if (od === '0' && o.dispute_open) toast.warning(`분쟁 접수 · ${o.order_no}`, { description: '관리자가 대화에 참여해 중재를 시작합니다.' });
    }
  }, [q.data]);
  return null;
}

function useAdminOrders(filter: 'crypto' | 'disputes') {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-orders', filter], retry: false, queryFn: async () => {
    let b = supabase.from('orders').select('id,order_no,buyer_id,seller_id,seller_name,title,image_url,amount_usd,stage,courier,tracking_number,created_at,network,txid,payment_verified_at,dispute_open').order('created_at', { ascending: false });
    b = filter === 'crypto' ? b.not('txid', 'is', null) : b.eq('dispute_open', true);
    const { data, error } = await b; if (error) throw error;
    const orders = (data ?? []) as Order[];
    let msgs: Msg[] = [];
    if (filter === 'disputes' && orders.length) { const r = await supabase.from('order_messages').select('id,order_id,author_role,kind,body,areas,created_at').in('order_id', orders.map(o => o.id)).order('created_at'); msgs = (r.data ?? []) as Msg[]; }
    return { orders, msgs };
  } });
  useEffect(() => {
    const ch = supabase.channel(`admin-orders-${filter}`);
    for (const table of ['orders', 'order_messages']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => void qc.invalidateQueries({ queryKey: ['admin-orders', filter] }));
    ch.subscribe(); return () => { void supabase.removeChannel(ch); };
  }, [filter, qc]);
  return q;
}

/** Admin: real submitted TXIDs with 1-click block-explorer verification. */
export function AdminCryptoOrders() {
  const q = useAdminOrders('crypto');
  if (q.isLoading) return <p className="text-sm text-muted-foreground">주문을 불러오는 중…</p>;
  if (q.error) return <p className="text-sm text-muted-foreground">관리자 계정으로 로그인하면 실제 TXID를 확인할 수 있습니다.</p>;
  const orders = q.data?.orders ?? [];
  if (!orders.length) return <div className="lux-empty"><ShieldCheck /><h2>수신된 실제 TXID가 없습니다.</h2><p>구매자가 TXID를 제출하면 여기에 실시간으로 표시됩니다.</p></div>;
  return <div className="management-list">{orders.map(o => { const ex = explorerUrl(o.network, o.txid!); return <div className="management-row" key={o.id}>
    <div className="min-w-0"><strong>{o.title}</strong><small data-no-translate>{o.order_no} · {o.seller_name} · {o.network ?? '—'}</small><small className="break-all" data-no-translate>TXID {o.txid}</small></div>
    <strong>{dollars(Number(o.amount_usd))}</strong>
    <span className="record-status">{o.payment_verified_at ? '입금 확인됨' : '검증 대기'}</span>
    <div className="record-actions">
      <Button asChild variant="ghost" size="sm"><a href={ex.url} target="_blank" rel="noreferrer"><ExternalLink />{ex.name}에서 확인</a></Button>
      {!o.payment_verified_at && <Button variant="goldOutline" size="sm" onClick={() => { if (confirm(`${ex.name}에서 금액과 수신 주소를 확인하셨나요? 결제 확인으로 처리합니다.`)) void supabase.from('orders').update({ payment_verified_at: new Date().toISOString() }).eq('id', o.id).then(r => r.error ? toast.error(r.error.message) : toast.success('결제 확인 처리되었습니다.')); }}><Check />결제 확인</Button>}
    </div></div>; })}</div>;
}

/** Admin: 3-way dispute rooms for orders with an open dispute. */
export function AdminDisputeRooms() {
  const q = useAdminOrders('disputes');
  if (q.isLoading) return <p className="text-sm text-muted-foreground">분쟁을 불러오는 중…</p>;
  if (q.error) return <p className="text-sm text-muted-foreground">관리자 계정으로 로그인하면 실제 분쟁방을 확인할 수 있습니다.</p>;
  const orders = q.data?.orders ?? [];
  if (!orders.length) return <div className="lux-empty"><AlertTriangle /><h2>접수된 실제 분쟁이 없습니다.</h2></div>;
  return <div className="grid gap-4">{orders.map(o => <article className="escrow-order" key={o.id}>
    <div className="escrow-order-head"><AlertTriangle className="text-primary" /><div><span className="lux-eyebrow" data-no-translate>{o.order_no}</span><strong>{o.title}</strong><small>{stageLabel(o.stage as EscrowStage)} · {o.seller_name} · {dollars(Number(o.amount_usd))}</small></div>
      <Button variant="ghost" size="sm" onClick={() => { if (confirm('분쟁을 종료할까요?')) void supabase.from('orders').update({ dispute_open: false }).eq('id', o.id).then(r => r.error ? toast.error(r.error.message) : toast.success('분쟁을 종료했습니다.')); }}>분쟁 종료</Button></div>
    <Thread msgs={(q.data?.msgs ?? []).filter(m => m.order_id === o.id)} />
    <Composer orderId={o.id} role="admin" />
  </article>)}</div>;
}
