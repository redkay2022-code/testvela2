import type { LuxuryPost } from '@/lib/luxury-market';
import { sellerMatches } from '@/lib/seller-directory';
import { SellerBadge } from './reputation';
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ImagePlus, MessageSquareText, Package, Store, X } from 'lucide-react';
import { useMarketPreview } from './market-preview';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/i18n';
import { sellerKey } from '@/lib/seller-directory';

const BUCKET = 'review-media';
type Review = { id: string; nickname: string; seller_id: string; seller_name: string; body: string; media_urls: string[]; video_url: string | null; created_at: string; urls: Record<string, string> };

async function loadReviews(sellerId?: string): Promise<Review[]> {
  const columns = 'id,nickname,seller_id,seller_name,body,media_urls,video_url,created_at';
  const query = () => supabase.from('reviews').select(columns).order('created_at', { ascending: false }).limit(60);
  const quoted = sellerId ? `"${sellerId.replace(/["\\]/g, '\\$&')}"` : '';
  let result = sellerId ? await query().or(`seller_id.eq.${quoted},seller_name.eq.${quoted}`) : await query();
  if (result.error && sellerId) result = await query().eq('seller_id', sellerId);
  if (result.error) throw result.error;
  const key = sellerKey(sellerId ?? '');
  const rows = (result.data ?? []).filter(r => !sellerId || r.seller_id === sellerId || sellerKey(r.seller_id) === key || sellerKey(r.seller_name) === key);
  const paths = rows.flatMap(r => [...r.media_urls, ...(r.video_url ? [r.video_url] : [])]);
  const urls: Record<string, string> = {};
  if (paths.length) { const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600); signed?.forEach(s => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; }); }
  return rows.map(r => ({ ...r, urls }));
}

export function ReviewList({ sellerId, role, posts }: { sellerId?: string; role?: 'buyer' | 'seller' | 'admin' | undefined; posts?: LuxuryPost[] }) {
  const repFor = (id: string, name: string) => posts?.find(p => sellerMatches(p, id) || sellerMatches(p, name))?.reputation;
  const { data, isLoading } = useQuery({ queryKey: ['reviews', sellerId ?? 'all'], queryFn: () => loadReviews(sellerId) });
  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">리뷰를 불러오는 중…</p>;
  if (!data?.length) return <div className="lux-empty"><MessageSquareText/><h2>아직 고객 리뷰가 없습니다.</h2></div>;
  return <div className="mt-4 grid gap-4">{data.map(r => <article key={r.id} className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-1 font-semibold" data-no-translate>{r.nickname}<BadgeCheck size={14} className="text-primary" aria-label="인증 구매자"/></span><span className="text-muted-foreground">{formatDate(r.created_at)}</span></div>
    <Link to="/store" search={{ role, seller: r.seller_id, storeTab: 'reviews' }} className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-xs text-primary" data-no-translate><Store size={12}/>구매처: {r.seller_name}</Link>{(() => { const rep = repFor(r.seller_id, r.seller_name); return rep ? <span className="ml-2 align-middle"><SellerBadge reputation={rep}/></span> : null; })()}
    {r.video_url && r.urls[r.video_url] && <video src={r.urls[r.video_url]} className="mt-3 aspect-[9/16] max-h-96 w-full rounded-md bg-background object-cover" controls muted playsInline preload="metadata"/>}
    {r.media_urls.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{r.media_urls.map(p => r.urls[p] && <img key={p} src={r.urls[p]} alt="리뷰 사진" className="aspect-square w-full rounded-md object-cover" loading="lazy"/>)}</div>}
    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{r.body}</p>
  </article>)}</div>;
}

export function ReviewComposer({ orderId, requestAuth, onDone }: { orderId?: string | undefined; requestAuth: () => void; onDone?: () => void }) {
  const qc = useQueryClient(); const preview = useMarketPreview();
  const [userId, setUserId] = useState<string | null>(null), [nickname, setNickname] = useState('');
  const [picked, setPicked] = useState<string | undefined>(orderId), [body, setBody] = useState(''), [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  useEffect(() => { void supabase.auth.getUser().then(async ({ data }) => { const id = data.user?.id ?? null; setUserId(id); if (id) { const { data: p } = await supabase.from('profiles').select('nickname').eq('user_id', id).maybeSingle(); setNickname(p?.nickname ?? 'VELA 구매자'); } }); }, []);
  const [stars, setStars] = useState(0);
  const liveQ = useQuery({ queryKey: ['reviewable-orders', userId], enabled: !!userId, queryFn: async () => {
    const [o, r] = await Promise.all([supabase.from('orders').select('id, order_no, title, image_url, seller_id, seller_name').eq('buyer_id', userId!).eq('stage', 'delivered'), supabase.from('reviews').select('order_id').eq('user_id', userId!).not('order_id', 'is', null)]);
    const done = new Set((r.data ?? []).map(x => x.order_id));
    return (o.data ?? []).filter(x => x.seller_id && !done.has(x.id)).map(x => ({ id: x.id, label: x.order_no, title: x.title, image: x.image_url ?? undefined, sellerId: x.seller_id as string, sellerName: x.seller_name || 'Studio', live: true }));
  } });
  const sampleItems = preview.orders.filter(o => o.stage === 'delivered' && !o.reviewed && o.sellerId).map(o => ({ id: o.id, label: o.id, title: o.title, image: o.image, sellerId: o.sellerId as string, sellerName: o.sellerName ?? o.sellerId ?? '', live: false }));
  const eligible = [...(liveQ.data ?? []), ...sampleItems];
  const order = eligible.find(o => o.id === picked);
  if (!userId) return <div className="rounded-lg border border-primary/40 p-4 text-center text-sm"><p>구매 회원만 리뷰를 남길 수 있습니다.</p><Button variant="goldOutline" className="mt-3" onClick={requestAuth}>로그인하고 리뷰 쓰기</Button></div>;
  if (!order) return <div className="rounded-lg border border-border bg-card p-4"><h2 className="text-sm font-semibold">리뷰를 쓸 주문 선택</h2><p className="mt-1 text-xs text-muted-foreground">구매 확정된 주문만 리뷰를 남길 수 있습니다.</p>
    {eligible.length ? <div className="mt-3 grid gap-2">{eligible.map(o => <button type="button" key={o.id} onClick={() => setPicked(o.id)} className="flex items-center gap-3 rounded-md border border-border p-2 text-left hover:border-primary"><OrderThumb image={o.image}/><span className="min-w-0 flex-1"><span className="block truncate text-sm">{o.title}</span><span className="block text-xs text-primary" data-no-translate>구매처: {o.sellerName}</span></span><span className="text-xs text-muted-foreground" data-no-translate>{o.live ? o.label : `${o.label} · 샘플`}</span></button>)}</div> : <p className="mt-3 text-xs text-muted-foreground">리뷰를 쓸 수 있는 배송 완료 주문이 없습니다.</p>}</div>;
  const pick = (list: FileList | null) => {
    const all = Array.from(list ?? []); const video = all.find(f => f.type.startsWith('video/')); const photos = all.filter(f => f.type.startsWith('image/')).slice(0, 6);
    if (video && video.size > 200 * 1024 * 1024) return setMsg('영상은 200MB 이하만 올릴 수 있어요.');
    setMsg(''); setFiles([...(video ? [video] : []), ...photos]);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!body.trim() || !order.sellerId) return setMsg('리뷰 내용을 입력해 주세요.');
    if (order.live && !stars) return setMsg('별점(1~5점)을 선택해 주세요.');
    setBusy(true); setMsg('');
    try {
      let video_url: string | null = null; const media_urls: string[] = [];
      for (const f of files) {
        const ext = f.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin'; const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f); if (error) throw error;
        if (f.type.startsWith('video/')) video_url = path; else media_urls.push(path);
      }
      const { error } = await supabase.from('reviews').insert({ user_id: userId, nickname, seller_id: order.sellerId, seller_name: order.sellerName || order.sellerId, body: `[${order.title}] ${body.trim()}`.slice(0, 1000), media_urls, video_url, ...(order.live ? { order_id: order.id, rating: stars } : {}) });
      if (error) throw error;
      if (!order.live) preview.markReviewed(order.id); setStars(0); void qc.invalidateQueries({ queryKey: ['reviewable-orders'] }); void qc.invalidateQueries({ queryKey: ['seller-rating-map'] }); void qc.invalidateQueries({ queryKey: ['studio-tier'] }); setBody(''); setFiles([]); setPicked(undefined); setMsg('리뷰가 등록되어 판매자 스토어에도 게시되었습니다.'); void qc.invalidateQueries({ queryKey: ['reviews'] }); onDone?.();
    } catch { setMsg('리뷰를 등록하지 못했어요. 다시 시도해 주세요.'); } finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="rounded-lg border border-border bg-card p-4">
    <h2 className="text-sm font-semibold">구매 리뷰 쓰기</h2>
    <div className="mt-3 flex items-center gap-3 rounded-md border border-primary/40 bg-background p-3" aria-label="리뷰 대상 주문"><OrderThumb image={order.image}/><div className="min-w-0 flex-1"><p className="truncate text-sm">{order.title}</p><p className="text-xs text-primary" data-no-translate>구매처: {order.sellerName}</p></div>{!orderId && <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(undefined)}>변경</Button>}</div>
    {order.live ? <><p className="form-label">셀러 평가 (필수)</p><div className="star-picker" role="radiogroup" aria-label="별점">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} role="radio" aria-checked={stars === n} aria-label={`${n}점`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>)}<span className="ml-2 self-center text-xs text-muted-foreground">{stars ? `${stars}점` : '별을 눌러 평가하세요'}</span></div></> : <p className="mt-2 text-xs text-muted-foreground">샘플 주문은 별점 없이 리뷰만 남길 수 있어요. 실제 배송 완료 주문만 셀러 평점에 반영됩니다.</p>}
    <label className="form-label" htmlFor="review-body">리뷰 내용</label>
    <textarea id="review-body" className="form-input" maxLength={900} value={body} onChange={e => setBody(e.target.value)} placeholder="상품 상태, 배송, 검수 경험을 알려주세요" required/>
    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><ImagePlus size={16} className="text-primary"/>사진(최대 6장)·영상(1개) 추가<input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={e => pick(e.target.files)}/></label>
    {files.length > 0 && <p className="mt-1 text-xs text-primary">{files.length}개 파일 선택됨</p>}
    {msg && <p className="mt-2 text-xs text-muted-foreground" role="status">{msg}</p>}
    <Button variant="gold" className="mt-4 w-full" disabled={busy} type="submit">{busy ? '등록 중…' : '리뷰 등록'}</Button>
  </form>;
}

function OrderThumb({ image }: { image?: string | undefined }) {
  return image ? <img src={image} width={48} height={48} alt="" className="size-12 rounded-md object-cover"/> : <span className="flex size-12 items-center justify-center rounded-md bg-muted"><Package size={18} className="text-primary"/></span>;
}

/** Opens right after purchase confirmation with the order pre-filled. */
export function ReviewModal({ orderId, close, requestAuth }: { orderId: string; close: () => void; requestAuth: () => void }) {
  return <div role="dialog" aria-modal="true" aria-label="구매 리뷰" className="fixed inset-0 z-[100] flex items-end justify-center bg-background/80 p-4 sm:items-center">
    <div className="max-h-[90vh] w-full max-w-md overflow-y-auto"><div className="mb-2 flex justify-end"><Button variant="ghost" size="icon" aria-label="닫기" onClick={close}><X/></Button></div><ReviewComposer orderId={orderId} requestAuth={requestAuth} onDone={close}/></div></div>;
}
