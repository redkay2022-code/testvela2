import { tx } from '@/lib/dom-translate';
import { useCurrency } from './currency';
import { Link, useRouterState } from '@tanstack/react-router';
import { marketSearch, postsQuery } from '@/lib/market';
import { SpecsTable } from './specs-table';
import { useEffect, useRef, useState } from 'react';
import { ReviewModal } from './customer-reviews';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertTriangle, Camera, Check, ChevronLeft, ChevronRight, ExternalLink, MapPin, MessageSquareText, RefreshCw, Send, ShieldCheck, Truck, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cardImageOf, dollars, luxuryPosts } from '@/lib/luxury-market';
import { getOrderThumbs } from '@/lib/order-thumbs.functions';
import { isSellerBuyerBlocked } from '@/lib/seller-role';
import { qcAreas, stageLabel, type EscrowStage } from '@/lib/escrow';
import { getOrderTracking } from '@/lib/tracking.functions';
import { EscrowTimeline } from './escrow';
import { TranslatableText } from './translatable-text';
import { ListPagination, usePagination } from './list-pagination';
import { confirmOrderPayment } from '@/lib/order-verification.functions';
import { isLogisticsOrder } from '@/lib/store-content';
import { MAX_PRODUCT_PRICE_USD, PRICE_CAP_ENABLED, priceCapBuyMessage } from '@/lib/price-cap';
import { POINT_HOLD_DAYS } from '@/lib/loyalty';
import { COURIER_NAMES } from '@/lib/couriers';

export const QC_MIN_PHOTOS = 9, QC_MIN_VIDEOS = 1, QC_MAX_PHOTOS = 14, QC_MAX_VIDEOS = 1, QC_MAX_VIDEO_SEC = 60;
/** Reads a video's length in seconds from its metadata (NaN if it cannot be read). */
const videoSeconds = (f: File) => new Promise<number>(res => { const v = document.createElement('video'), u = URL.createObjectURL(f); const done = (n: number) => { URL.revokeObjectURL(u); res(n); }; v.preload = 'metadata'; v.onloadedmetadata = () => done(v.duration); v.onerror = () => done(NaN); v.src = u; });
/** Product thumbnail with a placeholder when the image is missing or fails to load. */
export function OrderThumb({ srcs, size = 52 }: { srcs: (string | null | undefined)[]; size?: number }) { const list = [...new Set(srcs.filter((x): x is string => Boolean(x)))]; const key = list.join('|'); const [idx, setIdx] = useState(0); useEffect(() => setIdx(0), [key]); const src = list[idx]; const box = { width: size, height: size }; return src ? <img key={src} src={src} width={size} height={size} style={box} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="shrink-0 rounded-md object-cover" onError={() => setIdx(n => n + 1)} /> : <span style={box} className="flex shrink-0 items-center justify-center rounded-md bg-muted"><Camera className="text-primary" /></span>; }
const BUCKET = 'qc-media';
const extOf = (f: File) => (f.name.split('.').pop() || '').toLowerCase();
/* 일부 폰은 파일 형식(type)을 비워 보내므로 확장자로도 사진/영상을 구분한다. */
const isVideoFile = (f: File) => f.type.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm', '3gp'].includes(extOf(f));
const isImageFile = (f: File) => f.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extOf(f));
const QC_VIDEO_UNREADABLE_MAX_MB = 150;
export type Order = { shipping?: Record<string, string> | null; id: string; order_no: string; buyer_id: string; seller_id: string | null; seller_name: string; title: string; image_url: string | null; amount_usd: number; stage: string; courier: string | null; tracking_number: string | null; created_at: string; network: string | null; txid: string | null; payment_verified_at: string | null; dispute_open: boolean; post_id: string | null; cancelled_at: string | null; points_earn_base?: number; points_pending?: number; points_earned?: number; points_redeemed?: number };
type Media = { id: string; order_id: string; path: string; kind: 'image' | 'video'; round: number; url?: string };
type Msg = { id: string; order_id: string; author_role: string; kind: string; body: string; areas: string[]; created_at: string };

export const couriers = COURIER_NAMES;
export const CUSTOM_COURIER = '__custom__';
/** Block explorer page for a submitted TXID on its network. */
export function explorerUrl(network: string | null, txid: string) {
  const t = encodeURIComponent(txid.trim());
  if (network === 'USDT-TRC20') return { name: 'Tronscan', url: `https://tronscan.org/#/transaction/${t}` };
  if (network === 'BTC') return { name: 'Mempool', url: `https://mempool.space/tx/${t}` };
  return { name: 'Etherscan', url: `https://etherscan.io/tx/${t.startsWith('0x') ? t : `0x${t}`}` };
}
const courierLink = (c: string | null, n: string) => `https://t.17track.net/en#nums=${encodeURIComponent(n)}`;

/** 결제 전에 막아야 하는 주문인지 확인합니다: 본인 상품 구매, 셀러 계정의 구매, 판매 최고가 초과. DB 트리거도 같은 규칙으로 한 번 더 막습니다. */
export async function orderBlockReason(input: { seller_id: string | null; product_usd: number }): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (data.user && input.seller_id && input.seller_id === data.user.id) return tx('내가 올린 상품은 구매할 수 없습니다.');
  if (data.user && await isSellerBuyerBlocked(data.user.id)) return tx('셀러 계정은 상품을 구매할 수 없습니다.');
  if (PRICE_CAP_ENABLED && input.product_usd > MAX_PRODUCT_PRICE_USD) return priceCapBuyMessage();
  return null;
}

/** Creates a persistent order for a signed-in buyer after TXID submission. */
export async function createLiveOrder(input: { post_id: string; title: string; image_url?: string; amount_usd: number; product_amount_usd?: number; points_redeemed?: number; seller_id: string | null; seller_name: string; network: string; txid?: string; shipping: Record<string, string> }) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('로그인이 필요합니다.');
  const blocked = await orderBlockReason({ seller_id: input.seller_id, product_usd: input.product_amount_usd ?? input.amount_usd });
  if (blocked) throw new Error(blocked);
  const { data: row, error } = await supabase.from('orders').insert({ ...input, txid: input.txid || null, buyer_id: data.user.id }).select('id').single();
  if (error) throw error;
  return row.id;
}

function useLive(userId: string | null, admin = false) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['live-orders', userId, admin], enabled: !!userId, refetchInterval: 5000,
    queryFn: async () => {
      let ob = supabase.from('orders').select('id,order_no,buyer_id,seller_id,seller_name,title,image_url,amount_usd,stage,courier,tracking_number,created_at,network,txid,payment_verified_at,dispute_open,post_id,cancelled_at,points_earn_base,points_pending,points_earned,points_redeemed').order('created_at', { ascending: false });
      if (!admin) ob = ob.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
      const { data: orders, error } = await ob;
      if (error) throw error;
      const ids = (orders ?? []).map(o => o.id);
      const [m, msgs] = ids.length ? await Promise.all([
        supabase.from('order_qc_media').select('id,order_id,path,kind,round').in('order_id', ids).order('created_at'),
        supabase.from('order_messages').select('id,order_id,author_role,kind,body,areas,created_at').in('order_id', ids).order('created_at'),
      ]) : [{ data: [], error: null }, { data: [], error: null }];
      if (m.error) throw m.error;
      if (msgs.error) throw msgs.error;
      const media = (m.data ?? []) as Media[];
      if (media.length) { const { data: s } = await supabase.storage.from(BUCKET).createSignedUrls(media.map(x => x.path), 3600); const map = new Map(s?.map(x => [x.path, x.signedUrl])); media.forEach(x => { const u = map.get(x.path); if (u) x.url = u; }); }
      return { orders: (orders ?? []) as Order[], media, msgs: (msgs.data ?? []) as Msg[] };
    },
  });
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`orders-live-${userId}-${crypto.randomUUID()}`);
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
  const { lang } = useCurrency();
  const [open, setOpen] = useState<number | null>(null);
  const cur = open !== null ? media[open] : undefined;
  const n = media.length, isOpen = open !== null, touchX = useRef<number | null>(null);
  /* 슬라이드: 좌우 화살표 버튼, 키보드 ←/→, 터치 스와이프. 끝에서 계속 넘기면 처음/끝으로 이어진다. */
  const go = (d: number) => setOpen(i => (i === null || n === 0 ? i : (i + d + n) % n));
  useEffect(() => {
    if (!isOpen) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [isOpen, n]);
  useEffect(() => { /* 다음/이전 사진을 미리 받아 두어 넘길 때 바로 보이게 한다. */
    if (open === null || n < 2) return;
    for (const d of [1, -1]) { const m = media[(open + d + n) % n]; if (m && m.kind === 'image' && m.url) new Image().src = m.url; }
  }, [open, n]);
  return <><div className="qc-grid">{media.map((m, i) => <button type="button" key={m.id} onClick={() => setOpen(i)} aria-label={tx("QC 파일 {0} 열기", { 0: i + 1 })}>{m.kind === 'video' ? <video src={m.url} muted playsInline preload="metadata" /> : <img src={m.url} alt={tx("QC 사진 {0}", { 0: i + 1 })} loading="lazy" decoding="async" />}<span>{i + 1}</span></button>)}</div>
    {cur && <div className="qc-lightbox" role="dialog" aria-label={tx("QC 파일")}
      onTouchStart={e => { touchX.current = (e.target as HTMLElement).tagName === 'VIDEO' ? null : e.touches[0]?.clientX ?? null; }}
      onTouchEnd={e => { const s = touchX.current; touchX.current = null; const x = e.changedTouches[0]?.clientX; if (s === null || x === undefined) return; if (x - s > 50) go(-1); else if (s - x > 50) go(1); }}>
      <Button variant="ghost" size="icon" aria-label={tx("닫기")} onClick={() => setOpen(null)}><X /></Button>
      {cur.kind === 'video' ? <video key={cur.id} src={cur.url} controls autoPlay playsInline /> : <img key={cur.id} src={cur.url} alt={tx("QC 사진")} />}
      {n > 1 && <div className="pointer-events-none absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
        <button type="button" className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-black/60 text-white" aria-label={tx("이전 사진")} onClick={() => go(-1)}><ChevronLeft /></button>
        <button type="button" className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-black/60 text-white" aria-label={tx("다음 사진")} onClick={() => go(1)}><ChevronRight /></button></div>}
      <p>{open! + 1} / {media.length}</p></div>}</>;
}

function Thread({ msgs, sellerName }: { msgs: Msg[]; sellerName?: string }) {
  const { lang } = useCurrency();
  if (!msgs.length) return null;
  return <ul className="mt-3 grid gap-2 text-sm">{msgs.map(m => <li key={m.id} className={`rounded-md border p-2 ${m.author_role === 'admin' ? 'border-primary bg-primary/20' : m.author_role === 'seller' ? 'border-border bg-card' : 'border-border bg-primary/10'}`}>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span><span data-i18n-skip data-no-translate translate="no" className="notranslate">{m.author_role === 'admin' ? tx('관리자 (중재)') : m.author_role === 'seller' ? sellerName || tx('셀러') : tx('구매자')}</span> · <span data-i18n-skip data-no-translate translate="no" className="notranslate">{m.kind === 'request' ? tx('추가 사진 요청') : m.kind === 'qc' ? tx('QC 업로드') : tx('메시지')}</span></span><span>{new Date(m.created_at).toLocaleString()}</span></div>
    {m.areas.length > 0 && <p className="mt-1 text-primary">{m.areas.join(', ')}</p>}
    {m.body && <TranslatableText as="p" className="mt-1 whitespace-pre-wrap" text={m.body} />}
  </li>)}</ul>;
}

export function Composer({ orderId, role, onSent }: { orderId: string; role: 'buyer' | 'seller' | 'admin'; onSent?: () => void }) {
  const { lang } = useCurrency();
  const [v, setV] = useState(''); const [busy, setBusy] = useState(false);
  return <form className="ship-form mt-2" onSubmit={async e => { e.preventDefault(); if (!v.trim()) return; setBusy(true); try { const { data } = await supabase.auth.getUser(); if(!data.user) throw new Error('로그인이 필요합니다.'); const {error}=await supabase.from('order_messages').insert({ order_id: orderId, author_id: data.user.id, author_role: role, body: v.trim().slice(0, 1000) }); if(error) throw error; setV(''); toast.success('요청을 전달했습니다.'); onSent?.(); } catch { toast.error('요청을 보내지 못했습니다. 다시 시도해 주세요.'); } finally { setBusy(false); } }}>
    <input className="form-input" maxLength={1000} value={v} onChange={e => setV(e.target.value)} placeholder={tx("메시지 남기기")} aria-label={tx("메시지")} /><Button variant="goldOutline" type="submit" disabled={busy}><Send /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("보내기")}</span></Button></form>;
}

function TrackingPanel({ o }: { o: Order }) {
  const { lang } = useCurrency();
  const fetchTrack = useServerFn(getOrderTracking);
  const q = useQuery({ queryKey: ['tracking', o.id, o.tracking_number], enabled: !!o.tracking_number, queryFn: () => fetchTrack({ data: { orderId: o.id } }), refetchInterval: 10 * 60 * 1000 });
  if (!o.tracking_number) return null;
  const latest = q.data?.events[0];
  return <div className="tracking-widget"><Truck className="text-primary" />
    <div><span><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("택배사")}</span></span><strong>{o.courier}</strong></div>
    <div><span><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("송장번호")}</span></span><strong data-no-translate>{o.tracking_number}</strong></div>
    <div><span><MapPin size={10} className="inline" /> <span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("현재 상태")}</span></span><strong><span data-i18n-skip data-no-translate translate="no" className="notranslate">{latest ? `${latest.description}${latest.location ? ` · ${latest.location}` : ''}` : q.isLoading ? tx('조회 중…') : (q.data?.status ?? tx('대기'))}</span></strong></div>
    {q.data?.events && q.data.events.length > 1 && <ol className="col-span-full mt-2 grid gap-1 text-xs text-muted-foreground">{q.data.events.slice(1, 8).map((e, i) => <li key={i}>{e.time ? new Date(e.time).toLocaleString() : ''} · {e.description} {e.location}</li>)}</ol>}
    <small className="col-span-full flex flex-wrap items-center gap-2">
      <span data-i18n-skip data-no-translate translate="no" className="notranslate">{q.data && !q.data.configured ? tx('자동 추적 서비스 연결 대기 중 · ') : q.data?.checkedAt ? tx("마지막 조회 {0} · ", { 0: new Date(q.data.checkedAt).toLocaleTimeString() }) : ''}</span>
      <a className="text-primary underline" href={courierLink(o.courier, o.tracking_number)} target="_blank" rel="noreferrer"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("택배사 조회 열기")}</span></a>
      {q.data?.configured && <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={() => void fetchTrack({ data: { orderId: o.id, force: true } }).then(() => q.refetch())}><RefreshCw size={11} /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("새로고침")}</span></button>}
      {q.data?.error}
    </small></div>;
}

function QcUploader({ o, round, supplement, have }: { o: Order; round: number; supplement: boolean; have: { imgs: number; vids: number } }) {
  const { lang } = useCurrency();
  const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const imgs = files.filter(isImageFile).length, vids = files.filter(isVideoFile).length;
  /* 이미 서버에 올라간 파일(중간에 끊겼던 업로드)도 함께 센다. */
  const totImgs = have.imgs + imgs, totVids = have.vids + vids;
  /* 111차: 사진·영상 개수와 상관없이 완료할 수 있다(최대 개수만 제한). 추가 사진 요청 단계는 파일 1개 이상. */
  const ok = totImgs <= QC_MAX_PHOTOS && totVids <= QC_MAX_VIDEOS && (!supplement || files.length >= 1);
  const add = async (list: File[]) => {
    setErr(''); const next = [...files];
    for (const f of list.filter(x => isImageFile(x) || isVideoFile(x))) {
      if (isVideoFile(f)) {
        if (have.vids + next.filter(isVideoFile).length >= QC_MAX_VIDEOS) { setErr(tx("영상은 {0}개만 업로드할 수 있습니다.", { 0: QC_MAX_VIDEOS })); continue; }
        const d = await videoSeconds(f);
        /* 길이를 읽지 못하는 영상(일부 폰 코덱)은 막지 않고 용량으로만 제한한다. */
        if (!Number.isFinite(d) && f.size > QC_VIDEO_UNREADABLE_MAX_MB * 1024 * 1024) { setErr(tx("영상 길이를 확인하지 못했습니다.")); continue; }
        if (Number.isFinite(d) && d > QC_MAX_VIDEO_SEC) { setErr(tx("영상은 {0}초 이내여야 합니다. (선택한 영상: {1}초)", { 0: QC_MAX_VIDEO_SEC, 1: Math.ceil(d) })); continue; }
      } else if (have.imgs + next.filter(isImageFile).length >= QC_MAX_PHOTOS) { setErr(tx("사진은 최대 {0}장까지 업로드할 수 있습니다.", { 0: QC_MAX_PHOTOS })); continue; }
      next.push(f);
    }
    setFiles(next);
  };
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await supabase.auth.getUser(); const uid = data.user!.id;
      for (const f of [...files]) {
        const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${o.id}/${crypto.randomUUID()}.${ext}`;
        const isVid = isVideoFile(f);
        const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || (isVid ? 'video/mp4' : 'image/jpeg') });
        if (up.error) throw up.error;
        const ins = await supabase.from('order_qc_media').insert({ order_id: o.id, uploader_id: uid, path, kind: isVid ? 'video' : 'image', round });
        if (ins.error) throw ins.error;
        setFiles(p => p.filter(x => x !== f)); /* 올라간 파일은 목록에서 빼서, 재시도해도 중복 업로드되지 않게 한다. */
      }
      if (imgs + vids > 0) await supabase.from('order_messages').insert({ order_id: o.id, author_id: uid, author_role: 'seller', kind: 'qc', body: `${supplement ? '추가' : 'QC'} 사진 ${imgs}장 · 영상 ${vids}개 업로드` });
      const st = await supabase.from('orders').update({ stage: 'qc_done' }).eq('id', o.id);
      if (st.error) throw st.error;
      setFiles([]);
    } catch (e) { const m = e instanceof Error ? e.message : ''; setErr(m || '업로드 실패'); } finally { setBusy(false); }
  };
  return <div className="qc-upload"><label className="qc-drop"><Upload size={18} /><span><span data-i18n-skip data-no-translate translate="no" className="notranslate">{supplement ? tx('요청받은 추가 사진·영상 업로드') : tx("디테일 사진·영상 업로드 (사진 최대 {0}장 · 영상 {1}개, 1분 이내)", { 0: QC_MAX_PHOTOS, 1: QC_MAX_VIDEOS })}</span></span>
    <input type="file" accept="image/*,video/*" multiple onChange={e => { const l = e.target.files ? [...e.target.files] : []; e.target.value = ''; if (l.length) void add(l); }} /></label>
    <p className={`qc-count ${ok ? 'ok' : ''}`}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("사진 {0}장 · 영상 {1}개", { 0: totImgs, 1: totVids })}</span><span data-i18n-skip data-no-translate translate="no" className="notranslate">{supplement ? '' : ' ' + tx("(최대 사진 {0}장 / 영상 {1}개)", { 0: QC_MAX_PHOTOS, 1: QC_MAX_VIDEOS })}</span></p>
    {files.length > 0 && <ul className="text-xs text-muted-foreground">{files.map((f, i) => <li key={i} className="flex justify-between"><span>{f.name}</span><button type="button" aria-label={tx("{0} 삭제", { 0: f.name })} onClick={() => setFiles(p => p.filter((_, j) => j !== i))}><X size={12} /></button></li>)}</ul>}
    {supplement && files.length === 0 && !busy && <p role="status" className="text-xs text-primary"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("추가 사진·영상을 1개 이상 선택해주세요.")}</span></p>}
    {err && <p className="text-xs text-destructive"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx(err)}</span></p>}
    <Button variant="gold" className="disabled:opacity-40 disabled:grayscale" disabled={!ok || busy} onClick={() => void submit()}><Check /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{busy ? tx('업로드 중…') : supplement ? tx('추가 사진 보내기') : tx('QC 완료 & 구매자에게 전송')}</span></Button></div>;
}

function RequestForm({ o, close }: { o: Order; close: () => void }) {
  const { lang } = useCurrency();
  const [areas, setAreas] = useState<string[]>([]); const [note, setNote] = useState('');
  return <div className="qc-request"><h3><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("추가 사진 요청")}</span></h3><div className="qc-areas">{qcAreas.map(a => <button type="button" key={a} aria-pressed={areas.includes(a)} className={areas.includes(a) ? 'active' : ''} onClick={() => setAreas(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a])}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx(a)}</span></button>)}</div>
    <textarea className="form-input" maxLength={500} value={tx(note)} onChange={e => setNote(e.target.value)} placeholder={tx("예: 야광을 완전히 어두운 곳에서 보여주세요")} aria-label={tx("요청 내용")} />
    <div className="escrow-actions"><Button variant="ghost" onClick={close}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("취소")}</span></Button><Button variant="gold" disabled={!areas.length && !note.trim()} onClick={async () => { const { data } = await supabase.auth.getUser(); await supabase.from('order_messages').insert({ order_id: o.id, author_id: data.user!.id, author_role: 'buyer', kind: 'request', areas, body: note.trim() }); await supabase.from('orders').update({ stage: 'qc_requested' }).eq('id', o.id); close(); }}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("요청 보내기")}</span></Button></div></div>;
}

function ShipForm({ o }: { o: Order }) {
  const { lang } = useCurrency();
  const [courier, setCourier] = useState(couriers[0]!); const [custom, setCustom] = useState(''); const [num, setNum] = useState(''); const [err, setErr] = useState('');
  const isCustom = courier === CUSTOM_COURIER;
  return <form className="ship-form" onSubmit={async e => { e.preventDefault(); const name = isCustom ? custom.trim() : courier; if (!name) { setErr(tx('택배사 이름을 입력해 주세요.')); return; } const r = await supabase.from('orders').update({ courier: name, tracking_number: num.trim(), stage: 'shipped' }).eq('id', o.id); setErr(r.error?.message ?? ''); }}>
    <select className="form-input" value={courier} onChange={e => setCourier(e.target.value)} aria-label={tx("택배사")}>{couriers.map(c => <option key={c} value={c}>{c}</option>)}<option value={CUSTOM_COURIER}>{tx("직접 입력")}</option></select>
    {isCustom && <input className="form-input" required maxLength={60} value={custom} onChange={e => setCustom(e.target.value)} placeholder={tx("택배사 이름 직접 입력")} aria-label={tx("택배사 이름 직접 입력")} />}
    <input className="form-input" required maxLength={40} pattern="[A-Za-z0-9\-]{6,40}" value={num} onChange={e => setNum(e.target.value)} placeholder={tx("송장번호")} aria-label={tx("송장번호")} />
    <Button variant="gold" type="submit"><Truck /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("발송 완료 & 송장 등록")}</span></Button>{err && <p className="text-xs text-destructive"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx(err)}</span></p>}</form>;
}

/** Persistent QC board: seller QC uploads, buyer approval / extra-photo requests, tracking. */
export function LiveOrderBoard({ as, logistics = false }: { as: 'buyer' | 'seller'; logistics?: boolean }) {
  const { lang } = useCurrency();
  const search=marketSearch.parse(useRouterState({select:s=>s.location.search}));
  const catalog=useQuery(postsQuery);
  const { user, admin } = useUser();
  const q = useLive(user?.id ?? null, admin);
  const [asking, setAsking] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const orders = !user ? [] : (q.data?.orders ?? []).filter(o => (as === 'buyer' ? o.buyer_id === user.id : (o.seller_id === user.id || (o.seller_id === null && admin))) && (!search.orderId||o.id===search.orderId) && (!logistics || Boolean(search.orderId) || isLogisticsOrder(o)));
  const thumbIds = [...new Set(orders.map(o => o.post_id).filter((x): x is string => Boolean(x)))].sort(), thumbFn = useServerFn(getOrderThumbs);
  const thumbs = useQuery({ queryKey: ['order-thumbs', thumbIds.join(',')], enabled: thumbIds.length > 0, staleTime: 30 * 60_000, retry: 1, queryFn: () => thumbFn({ data: { postIds: thumbIds } }) });
  /* 셀러의 물류/배송 목록은 페이지 번호로 나누어 보여 준다(구매자 화면은 그대로). */
  const pager = usePagination(orders, as + (search.orderId ?? ''));
  if (!user) return null;
  const setStage = async (id: string, stage: EscrowStage) => { setBusyId(id); const r = await supabase.from('orders').update({ stage }).eq('id', id); setBusyId(null); if (r.error) toast.error(r.error.message); else void q.refetch(); };
  return <section className="escrow-board mb-6 notranslate" aria-label={tx("QC 게시판")} lang={lang} translate="no" data-no-translate>
    {reviewing && <ReviewModal orderId={reviewing} close={() => setReviewing(null)} requestAuth={() => setReviewing(null)} />}
    <div className="section-heading"><h2><MessageSquareText size={16} className="mr-1 inline" /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("QC 게시판")}</span></h2><span><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("실시간 저장")}</span></span></div>
    {q.isError&&<p role="alert" className="text-destructive"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("주문 정보를 불러오지 못했습니다.")}</span></p>}
    {q.isLoading&&<p><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("주문을 불러오는 중…")}</span></p>}
    {!q.isLoading&&!orders.length && <p className="py-6 text-center text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{as === 'buyer' ? tx('결제한 실제 주문이 여기에 표시됩니다.') : tx('받은 실제 주문이 여기에 표시됩니다.')}</span></p>}
    {(as === 'seller' ? pager.items : orders).map(o => {
      const media = (q.data?.media ?? []).filter(m => m.order_id === o.id);
      const msgs = (q.data?.msgs ?? []).filter(m => m.order_id === o.id);
      const round = media.reduce((r, m) => Math.max(r, m.round), 0);
      const stage = o.stage as EscrowStage;
      const isSeller = as === 'seller';
      const product=luxuryPosts((catalog.data ?? []).filter(p=>p.id===o.post_id) as Parameters<typeof luxuryPosts>[0])[0];
      return <article className="escrow-order" key={o.id}>
        <div className="escrow-order-head"><OrderThumb srcs={[product ? cardImageOf(product) : null, product?.images?.[0], thumbs.data?.[o.post_id ?? ''], o.image_url]} /><div><span className="lux-eyebrow" data-no-translate>{o.order_no}</span><strong>{o.title}</strong><small><span data-i18n-skip translate="no" className="notranslate">{tx(stageLabel(stage))}</span> · {o.seller_name}</small></div><div className="text-right"><strong>{dollars(Number(o.amount_usd))}</strong></div></div>
        <EscrowTimeline stage={stage} />
        {search.orderView==='tracking'&&!o.tracking_number&&<p className="escrow-wait"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("송장번호가 아직 등록되지 않았습니다.")}</span></p>}
        {search.orderView==='qc'&&!media.length&&<p className="escrow-wait"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("출고 QC 사진·영상이 아직 등록되지 않았습니다.")}</span></p>}
        {search.orderView==='specs'&&<section className="py-4 border-y border-border"><h3 className="text-base font-semibold mb-3"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("보증 안내·제품 스펙")}</span></h3>{product?<SpecsTable specs={product.source.specs} fallback={<p className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("등록된 상품 사양이 없습니다.")}</span></p>}/>:<p className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("이 상품의 스펙 정보를 불러올 수 없습니다.")}</span></p>}<p className="text-xs text-muted-foreground my-3"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("주문에 연결된 상품 정보와 출고 QC 자료입니다. 별도로 발급된 보증서가 없으면 보증서가 제공되지 않습니다.")}</span></p><Button asChild variant="goldOutline"><Link to="/escrow-guide"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("VELA 구매 보호 안내")}</span></Link></Button></section>}
        {search.orderView==='defect'&&<section className="py-4 border-y border-border"><h3 className="text-base font-semibold"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("초기 불량·교환 접수")}</span></h3><p className="my-2 text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("불량 증상과 교환 요청을 남기면 이 주문의 판매자에게 전달됩니다.")}</span></p><Thread msgs={msgs}/><Composer orderId={o.id} role={as}/></section>}
        {media.length > 0 && <><h4 className="escrow-sub"><Camera size={14} /> <span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("QC 사진·영상 {0}개", { 0: media.length })}</span></h4><Gallery media={media} /></>}
        {isSeller && stage === 'placed' && <Button variant="gold" disabled={busyId === o.id} onClick={() => void setStage(o.id, 'preparing')}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("제품 준비 시작")}</span></Button>}
        {isSeller && stage === 'preparing' && <Button variant="gold" disabled={busyId === o.id} onClick={() => void setStage(o.id, 'qc')}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("QC 검수 시작")}</span></Button>}
        {isSeller && stage === 'qc' && <QcUploader o={o} round={1} supplement={false} have={{ imgs: media.filter(m => m.round === 1 && m.kind === 'image').length, vids: media.filter(m => m.round === 1 && m.kind === 'video').length }} />}
        {isSeller && stage === 'qc_requested' && <QcUploader o={o} round={round + 1} supplement have={{ imgs: 0, vids: 0 }} />}
        {isSeller && stage === 'qc_done' && <p className="escrow-wait"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("구매자의 QC 확인을 기다리는 중입니다.")}</span></p>}
        {isSeller && stage === 'shipping_prep' && <ShipForm o={o} />}
        {!isSeller && stage === 'qc_requested' && <p className="escrow-wait"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("셀러가 추가 사진을 준비 중입니다.")}</span></p>}
        {!isSeller && stage === 'qc_done' && (asking === o.id ? <RequestForm o={o} close={() => setAsking(null)} /> : <div className="escrow-actions"><Button variant="gold" disabled={busyId === o.id} onClick={() => void setStage(o.id, 'shipping_prep')}><Check /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("승인하기")}</span></Button><Button variant="goldOutline" onClick={() => setAsking(o.id)}><Camera /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("추가 사진 요청")}</span></Button></div>)}
        <TrackingPanel o={o} />
        {!isSeller && stage === 'shipped' && <Button variant="gold" className="w-full" onClick={() => void setStage(o.id, 'delivered')}><ShieldCheck /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("수령 확인 및 구매 확정")}</span></Button>}
        {!isSeller && stage === 'delivered' && <Button variant="gold" className="w-full" onClick={() => setReviewing(o.id)}><Star /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("리뷰 작성 및 셀러 평가")}</span></Button>}
        {!isSeller && o.payment_verified_at && !o.cancelled_at && <p className="mt-2 text-xs text-muted-foreground" data-i18n-skip data-no-translate translate="no">{(o.points_earned ?? 0) > 0 ? tx('포인트 {0} P 적립 완료', { 0: new Intl.NumberFormat('en-US').format(o.points_earned ?? 0) }) : (o.points_pending ?? 0) > 0 ? tx('포인트 {0} P 적립 예정 · 수령 확정 {1}일 후 지급', { 0: new Intl.NumberFormat('en-US').format(o.points_pending ?? 0), 1: String(POINT_HOLD_DAYS) }) : (o.points_earn_base ?? 0) === 0 ? tx('이 주문은 포인트가 적립되지 않습니다. (적립 한도 마감 또는 소액 주문)') : ''}</p>}
        {!o.payment_verified_at && <p className="escrow-wait"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("관리자가 TXID 입금을 확인하는 중입니다.")}</span></p>}
        {o.dispute_open && <p className="mt-3 flex items-center gap-2 rounded-md border border-primary p-2 text-sm text-primary"><AlertTriangle size={15} /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("분쟁 진행 중 · 관리자가 참여한 3자 분쟁방입니다. 에스크로 대금은 중재가 끝날 때까지 보류됩니다.")}</span></p>}
        <div className="escrow-actions mt-3">
          <Button variant="goldOutline" onClick={() => setChat(chat === o.id ? null : o.id)}><MessageSquareText /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{o.dispute_open ? tx('분쟁방 열기') : isSeller ? tx('구매자에게 메시지') : tx('판매자에게 메시지')}</span>{msgs.length ? ` (${msgs.length})` : ''}</Button>
          {!o.dispute_open && stage !== 'delivered' && <Button variant="ghost" onClick={() => { if (confirm('분쟁을 열면 관리자가 대화에 참여하고 에스크로 대금이 보류됩니다. 계속할까요?')) void supabase.from('orders').update({ dispute_open: true }).eq('id', o.id).then(r => { if (r.error) toast.error(r.error.message); else setChat(o.id); }); }}><AlertTriangle /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("분쟁 열기")}</span></Button>}
        </div>
        {(chat === o.id || search.orderView === 'messages') && <div className="mt-2"><h3 className="text-sm font-semibold"><span data-i18n-skip translate="no" className="notranslate">{tx('메시지')}</span> · <span data-i18n-skip>{o.seller_name}</span></h3><Thread msgs={msgs} sellerName={o.seller_name}/><Composer orderId={o.id} role={as} onSent={() => void q.refetch()} /></div>}
      </article>;
    })}
    {as === 'seller' && <ListPagination pager={pager} />}
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
  const q = useLive(uid, false);
  const client = useQueryClient();
  const notifications = useQuery({ queryKey: ['payment-notices', uid], enabled: !!uid, refetchInterval: 5000, queryFn: async () => {
    if (!uid) return [];
    const { data, error } = await supabase.from('notifications').select('id,title,body').eq('user_id', uid).eq('kind', 'payment_verified').is('read_at', null).order('created_at', { ascending: false }).limit(50);
    if (error) throw error; return data ?? [];
  } });
  const seenNotices = useRef(new Set<string>());
  useEffect(() => {
    if (!uid) return;
    for (const notice of notifications.data ?? []) {
      const key = `vela-payment-notice:${uid}:${notice.id}`;
      if (seenNotices.current.has(key)) continue;
      seenNotices.current.add(key);
      try { if (localStorage.getItem(key)) continue; localStorage.setItem(key, '1'); } catch { /* in-memory deduplication */ }
      toast.success(notice.title, { description: notice.body, duration: 7000 });
    }
  }, [notifications.data, uid]);
  useEffect(() => { prev.current = null; }, [uid]);
  const prev = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const orders = q.data?.orders; if (!orders) return;
    const next = new Map(orders.map(o => [o.id, `${o.stage}|${o.payment_verified_at ? 1 : 0}|${o.dispute_open ? 1 : 0}`]));
    const before = prev.current; prev.current = next;
    if (!before) return;
    for (const o of orders) {
      const old = before.get(o.id); if (!old || old === next.get(o.id)) continue;
      const [os, op, od] = old.split('|');
      if (op === '0' && o.payment_verified_at) {
        for (const key of ['active-transactions', 'admin-orders', 'my-orders', 'seller-workflows', 'loyalty-summary', 'point-history', 'notifications', 'payment-notices']) void client.invalidateQueries({ queryKey: [key] });
      }
      if (os !== o.stage && stageToast[o.stage]) { const [t, d] = stageToast[o.stage]!; toast.success(`${t} · ${o.order_no}`, { description: `${o.title} — ${d}${o.stage === 'shipped' && o.tracking_number ? ` (${o.courier} ${o.tracking_number})` : ''}` }); }
      if (od === '0' && o.dispute_open) toast.warning(`분쟁 접수 · ${o.order_no}`, { description: '관리자가 대화에 참여해 중재를 시작합니다.' });
    }
  }, [q.data, client]);
  return null;
}

export function useAdminOrders(filter: 'crypto' | 'disputes') {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-orders', filter], retry: false, queryFn: async () => {
    let b = supabase.from('orders').select('id,order_no,buyer_id,seller_id,seller_name,title,image_url,amount_usd,stage,courier,tracking_number,created_at,network,txid,payment_verified_at,dispute_open,post_id,cancelled_at,shipping').order('created_at', { ascending: false });
    b = filter === 'crypto' ? b : b.eq('dispute_open', true);
    const { data, error } = await b; if (error) throw error;
    const orders = (data ?? []) as Order[];
    let msgs: Msg[] = [];
    if (filter === 'disputes' && orders.length) { const r = await supabase.from('order_messages').select('id,order_id,author_role,kind,body,areas,created_at').in('order_id', orders.map(o => o.id)).order('created_at'); msgs = (r.data ?? []) as Msg[]; }
    return { orders, msgs };
  } });
  useEffect(() => {
    const ch = supabase.channel(`admin-orders-${filter}-${crypto.randomUUID()}`);
    for (const table of ['orders', 'order_messages']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => void qc.invalidateQueries({ queryKey: ['admin-orders', filter] }));
    ch.subscribe(); return () => { void supabase.removeChannel(ch); };
  }, [filter, qc]);
  return q;
}

/** Admin: real submitted TXIDs with 1-click block-explorer verification. */
export function AdminCryptoOrders({ bucket = 'all' }: { bucket?: OrderBucket } = {}) {
  const q = useAdminOrders('crypto'), client = useQueryClient(), verify = useServerFn(confirmOrderPayment);
  const [busy, setBusy] = useState<string | null>(null);
  const confirmPayment = async (order: Order) => {
    const explorer = explorerUrl(order.network, order.txid ?? '');
    if (!window.confirm(`${explorer.name}에서 금액과 수신 주소를 확인하셨나요? 결제 확인으로 처리합니다.`)) return;
    setBusy(order.id);
    try {
      await verify({ data: { orderId: order.id } });
      await Promise.all(['live-orders','admin-orders','my-orders','seller-workflows','active-transactions','loyalty-summary','point-history','notifications','payment-notices'].map(key => client.invalidateQueries({ queryKey: [key] })));
    } catch (error) { toast.error(error instanceof Error ? error.message : '입금 확인에 실패했습니다.'); } finally { setBusy(null); }
  };
  if (q.isLoading) return <p className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("주문을 불러오는 중…")}</span></p>;
  if (q.error) return <p className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("관리자 계정으로 로그인하면 실제 TXID를 확인할 수 있습니다.")}</span></p>;
  const allOrders = q.data?.orders ?? [];
  const orders = allOrders.filter(o => inBucket(o, bucket));
  if (allOrders.length && !orders.length) return <p className="py-4 text-sm text-muted-foreground" lang="ko" data-no-translate>해당하는 주문이 없습니다.</p>;
  if (!orders.length) return <div className="lux-empty"><ShieldCheck /><h2><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("수신된 실제 TXID가 없습니다.")}</span></h2><p><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("구매자가 TXID를 제출하면 여기에 실시간으로 표시됩니다.")}</span></p></div>;
  return <div className="management-list">{orders.map(o => { const ex = explorerUrl(o.network, o.txid ?? ''); return <div className="management-row" key={o.id}>
    <div className="min-w-0"><strong>{o.title}</strong><small data-no-translate>{o.order_no} · {o.seller_name} · {o.network ?? '—'}</small><small className="break-all" data-no-translate>TXID {o.txid ?? tx('미제출')} · {tx(stageLabel(o.stage as EscrowStage))} · {new Date(o.created_at).toLocaleString()}</small></div>
    <strong>{dollars(Number(o.amount_usd))}</strong>
    <span className="record-status"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{o.payment_verified_at ? tx('입금 확인됨') : tx('검증 대기')}</span></span>
    <div className="record-actions">
      {o.txid && <Button asChild variant="ghost" size="sm"><a href={ex.url} target="_blank" rel="noreferrer"><ExternalLink /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("{0}에서 확인", { 0: ex.name })}</span></a></Button>}
      {!o.payment_verified_at && <Button variant="goldOutline" size="sm" disabled={busy !== null || !o.txid?.trim()} onClick={() => void confirmPayment(o)}><Check /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("입금 확인됨")}</span></Button>}
    </div></div>; })}</div>;
}

/** Admin: 3-way dispute rooms for orders with an open dispute. */
export function AdminDisputeRooms() {
  const q = useAdminOrders('disputes');
  if (q.isLoading) return <p className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("분쟁을 불러오는 중…")}</span></p>;
  if (q.error) return <p className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("관리자 계정으로 로그인하면 실제 분쟁방을 확인할 수 있습니다.")}</span></p>;
  const orders = q.data?.orders ?? [];
  if (!orders.length) return <div className="lux-empty"><AlertTriangle /><h2><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("접수된 실제 분쟁이 없습니다.")}</span></h2></div>;
  return <div className="grid gap-4">{orders.map(o => <article className="escrow-order" key={o.id}>
    <div className="escrow-order-head"><AlertTriangle className="text-primary" /><div><span className="lux-eyebrow" data-no-translate>{o.order_no}</span><strong>{o.title}</strong><small><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx(stageLabel(o.stage as EscrowStage))}</span> · {o.seller_name} · {dollars(Number(o.amount_usd))}</small></div>
      <Button variant="ghost" size="sm" onClick={() => { if (confirm('분쟁을 종료할까요?')) void supabase.from('orders').update({ dispute_open: false }).eq('id', o.id).then(r => r.error ? toast.error(r.error.message) : toast.success('분쟁을 종료했습니다.')); }}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("분쟁 종료")}</span></Button></div>
    <Thread msgs={(q.data?.msgs ?? []).filter(m => m.order_id === o.id)} />
    <Composer orderId={o.id} role="admin" />
  </article>)}</div>;
}

/** Admin: real order / deposit numbers (all orders, newest first). */
function useOrderStats() {
  const q = useAdminOrders('crypto');
  const orders = (q.data?.orders ?? []).filter(o => o.stage !== undefined);
  const sum = (l: Order[]) => l.reduce((a, o) => a + Number(o.amount_usd), 0);
  const waiting = orders.filter(o => !o.payment_verified_at), held = orders.filter(o => o.payment_verified_at && o.stage !== 'delivered'), done = orders.filter(o => o.stage === 'delivered');
  return { q, total: orders.length, waiting: waiting.length, waitingUsd: sum(waiting), heldUsd: sum(held), doneUsd: sum(done) };
}
export type OrderBucket = 'all' | 'waiting' | 'held' | 'done';
const bucketLabels: Record<OrderBucket, string> = { all: '전체 주문', waiting: '입금 확인 대기', held: '에스크로 보관', done: '구매 확정 (정산 대상)' };
const inBucket = (o: Order, bucket: OrderBucket) => bucket === 'all' ? true : bucket === 'waiting' ? !o.payment_verified_at : bucket === 'held' ? Boolean(o.payment_verified_at) && o.stage !== 'delivered' : o.stage === 'delivered';
/** 네 칸 요약: 칸을 누르면 해당 주문 목록이 아래에 열린다(다시 누르면 닫힘). */
function OrderStatGrid({ selected, onSelect }: { selected?: OrderBucket | null; onSelect?: (b: OrderBucket | null) => void }) {
  const s = useOrderStats();
  const usdFmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const items: [OrderBucket, string, string][] = [
    ['all', s.q.isLoading ? '…' : String(s.total), '실제 주문 · 실시간'],
    ['waiting', s.q.isLoading ? '…' : `${s.waiting}건`, usdFmt(s.waitingUsd)],
    ['held', usdFmt(s.heldUsd), '입금 확인 완료 · 구매 확정 전'],
    ['done', usdFmt(s.doneUsd), '수령 확인 완료'],
  ];
  return <div className="dashboard-stats order-stat-grid" lang="ko" data-no-translate>{items.map(([key, v, n]) => <button type="button" className={`stat-item order-stat-button ${selected === key ? 'is-selected' : ''}`} key={key} aria-pressed={selected === key} aria-label={`${bucketLabels[key]} 목록 ${selected === key ? '닫기' : '보기'}`} onClick={() => onSelect?.(selected === key ? null : key)}><span>{bucketLabels[key]}</span><strong>{v}</strong><small>{n}</small><em aria-hidden="true">{selected === key ? '목록 닫기 ▲' : '목록 보기 ▼'}</em></button>)}</div>;
}
export function AdminOrderSummary({ bare = false }: { bare?: boolean } = {}) {
  const [open, setOpen] = useState<OrderBucket | null>(null);
  return <section className={bare ? '' : 'mb-6'}><div className="section-heading" lang="ko" data-no-translate>{!bare && <h2>주문 · 입금 현황</h2>}<span>카드를 누르면 해당 주문이 열립니다 · 구매자가 TXID를 제출하면 바로 반영됩니다</span></div><OrderStatGrid selected={open} onSelect={setOpen} />{open && <div className="order-bucket-panel" lang="ko" data-no-translate><div className="section-heading"><h2>{bucketLabels[open]}</h2><Button variant="ghost" size="sm" onClick={() => setOpen(null)}>닫기</Button></div><AdminCryptoOrders bucket={open} /></div>}</section>;
}
/** Admin "Orders" tab: all real orders with deposit verification. */
export function AdminOrdersPanel() {
  const [bucket, setBucket] = useState<OrderBucket | null>(null);
  return <div className="mt-4"><OrderStatGrid selected={bucket} onSelect={setBucket} /><div className="section-heading mt-6" lang="ko" data-no-translate><h2>{bucket ? bucketLabels[bucket] : '전체 주문 · TXID 입금 확인'}</h2><span>{bucket ? '카드를 다시 누르면 전체로 돌아갑니다' : '최신순'}</span></div><AdminCryptoOrders bucket={bucket ?? 'all'} /></div>;
}
