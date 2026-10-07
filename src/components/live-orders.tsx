import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Camera, Check, MapPin, MessageSquareText, RefreshCw, Send, ShieldCheck, Truck, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { dollars } from '@/lib/luxury-market';
import { qcAreas, stageLabel, type EscrowStage } from '@/lib/escrow';
import { getOrderTracking } from '@/lib/tracking.functions';
import { EscrowTimeline } from './escrow';

export const QC_MIN_PHOTOS = 9, QC_MIN_VIDEOS = 1;
const BUCKET = 'qc-media';
type Order = { id: string; order_no: string; buyer_id: string; seller_id: string | null; seller_name: string; title: string; image_url: string | null; amount_usd: number; stage: string; courier: string | null; tracking_number: string | null; created_at: string };
type Media = { id: string; order_id: string; path: string; kind: 'image' | 'video'; round: number; url?: string };
type Msg = { id: string; order_id: string; author_role: string; kind: string; body: string; areas: string[]; created_at: string };

export const couriers = ['SF Express', 'EMS', 'DHL Express', 'FedEx', 'UPS', 'CJ Logistics', 'China Post'];
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
      const { data: orders, error } = await supabase.from('orders').select('id,order_no,buyer_id,seller_id,seller_name,title,image_url,amount_usd,stage,courier,tracking_number,created_at').order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (orders ?? []).map(o => o.id);
      const [m, msgs] = ids.length ? await Promise.all([
        supabase.from('order_qc_media').select('id,order_id,path,kind,round').in('order_id', ids).order('created_at'),
        supabase.from('order_messages').select('id,order_id,author_role,kind,body,areas,created_at').in('order_id', ids).order('created_at'),
      ]) : [{ data: [] }, { data: [] }];
      const media = (m.data ?? []) as Media[];
      if (media.length) { const { data: s } = await supabase.storage.from(BUCKET).createSignedUrls(media.map(x => x.path), 3600); const map = new Map(s?.map(x => [x.path, x.signedUrl])); media.forEach(x => { x.url = map.get(x.path) ?? undefined; }); }
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
  return <ul className="mt-3 grid gap-2 text-sm">{msgs.map(m => <li key={m.id} className={`rounded-md border border-border p-2 ${m.author_role === 'seller' ? 'bg-card' : 'bg-primary/10'}`}>
    <div className="flex justify-between text-xs text-muted-foreground"><span>{m.author_role === 'seller' ? '셀러' : '구매자'} · {m.kind === 'request' ? '추가 사진 요청' : m.kind === 'qc' ? 'QC 업로드' : '메시지'}</span><span>{new Date(m.created_at).toLocaleString()}</span></div>
    {m.areas.length > 0 && <p className="mt-1 text-primary">{m.areas.join(', ')}</p>}
    {m.body && <p className="mt-1 whitespace-pre-wrap">{m.body}</p>}
  </li>)}</ul>;
}

function Composer({ orderId, role }: { orderId: string; role: 'buyer' | 'seller' }) {
  const [v, setV] = useState(''); const [busy, setBusy] = useState(false);
  return <form className="ship-form mt-2" onSubmit={async e => { e.preventDefault(); if (!v.trim()) return; setBusy(true); const { data } = await supabase.auth.getUser(); await supabase.from('order_messages').insert({ order_id: orderId, author_id: data.user!.id, author_role: role, body: v.trim().slice(0, 1000) }); setV(''); setBusy(false); }}>
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
  if (!user) return null;
  const orders = (q.data?.orders ?? []).filter(o => as === 'buyer' ? o.buyer_id === user.id : (o.seller_id === user.id || (o.seller_id === null && admin)));
  const setStage = (id: string, stage: EscrowStage) => void supabase.from('orders').update({ stage }).eq('id', id);
  return <section className="escrow-board mb-6" aria-label="QC 게시판">
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
        <Thread msgs={msgs} />
        <Composer orderId={o.id} role={as} />
      </article>;
    })}
  </section>;
}
