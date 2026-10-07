import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ImagePlus, MessageSquareText, Store } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/i18n';

const BUCKET = 'review-media';
export type ReviewSeller = { id: string; name: string };
type Review = { id: string; nickname: string; seller_id: string; seller_name: string; body: string; media_urls: string[]; video_url: string | null; created_at: string; urls: Record<string, string> };

async function loadReviews(sellerId?: string): Promise<Review[]> {
  let q = supabase.from('reviews').select('id,nickname,seller_id,seller_name,body,media_urls,video_url,created_at').order('created_at', { ascending: false }).limit(60);
  if (sellerId) q = q.eq('seller_id', sellerId);
  const { data, error } = await q;
  if (error) throw error;
  const paths = (data ?? []).flatMap(r => [...r.media_urls, ...(r.video_url ? [r.video_url] : [])]);
  const urls: Record<string, string> = {};
  if (paths.length) { const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600); signed?.forEach(s => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; }); }
  return (data ?? []).map(r => ({ ...r, urls }));
}

export function ReviewList({ sellerId, role }: { sellerId?: string; role?: 'buyer' | 'seller' | 'admin' | undefined }) {
  const { data, isLoading } = useQuery({ queryKey: ['reviews', sellerId ?? 'all'], queryFn: () => loadReviews(sellerId) });
  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">리뷰를 불러오는 중…</p>;
  if (!data?.length) return <div className="lux-empty"><MessageSquareText/><h2>아직 고객 리뷰가 없습니다.</h2></div>;
  return <div className="mt-4 grid gap-4">{data.map(r => <article key={r.id} className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-1 font-semibold" data-no-translate>{r.nickname}<BadgeCheck size={14} className="text-primary" aria-label="인증 구매자"/></span><span className="text-muted-foreground">{formatDate(r.created_at)}</span></div>
    <Link to="/store" search={{ role, seller: r.seller_id, storeTab: 'reviews' }} className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-xs text-primary" data-no-translate><Store size={12}/>구매처: {r.seller_name}</Link>
    {r.video_url && r.urls[r.video_url] && <video src={r.urls[r.video_url]} className="mt-3 aspect-[9/16] max-h-96 w-full rounded-md bg-background object-cover" controls muted playsInline preload="metadata"/>}
    {r.media_urls.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{r.media_urls.map(p => r.urls[p] && <img key={p} src={r.urls[p]} alt="리뷰 사진" className="aspect-square w-full rounded-md object-cover" loading="lazy"/>)}</div>}
    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{r.body}</p>
  </article>)}</div>;
}

export function ReviewComposer({ sellers, requestAuth }: { sellers: ReviewSeller[]; requestAuth: () => void }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null), [nickname, setNickname] = useState('');
  const [seller, setSeller] = useState(''), [body, setBody] = useState(''), [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  useEffect(() => { void supabase.auth.getUser().then(async ({ data }) => { const id = data.user?.id ?? null; setUserId(id); if (id) { const { data: p } = await supabase.from('profiles').select('nickname').eq('user_id', id).maybeSingle(); setNickname(p?.nickname ?? 'VELA 구매자'); } }); }, []);
  if (!userId) return <div className="rounded-lg border border-primary/40 p-4 text-center text-sm"><p>구매 회원만 리뷰를 남길 수 있습니다.</p><Button variant="goldOutline" className="mt-3" onClick={requestAuth}>로그인하고 리뷰 쓰기</Button></div>;
  const pick = (list: FileList | null) => {
    const all = Array.from(list ?? []); const video = all.find(f => f.type.startsWith('video/')); const photos = all.filter(f => f.type.startsWith('image/')).slice(0, 6);
    if (video && video.size > 200 * 1024 * 1024) return setMsg('영상은 200MB 이하만 올릴 수 있어요.');
    setMsg(''); setFiles([...(video ? [video] : []), ...photos]);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); const s = sellers.find(x => x.id === seller); if (!s || !body.trim()) return setMsg('구매한 판매자와 리뷰 내용을 입력해 주세요.');
    setBusy(true); setMsg('');
    try {
      let video_url: string | null = null; const media_urls: string[] = [];
      for (const f of files) {
        const ext = f.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin'; const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f); if (error) throw error;
        if (f.type.startsWith('video/')) video_url = path; else media_urls.push(path);
      }
      const { error } = await supabase.from('reviews').insert({ user_id: userId, nickname, seller_id: s.id, seller_name: s.name, body: body.trim().slice(0, 1000), media_urls, video_url });
      if (error) throw error;
      setBody(''); setFiles([]); setSeller(''); setMsg('리뷰가 등록되었습니다.'); void qc.invalidateQueries({ queryKey: ['reviews'] });
    } catch { setMsg('리뷰를 등록하지 못했어요. 다시 시도해 주세요.'); } finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="rounded-lg border border-border bg-card p-4">
    <h2 className="text-sm font-semibold">구매 리뷰 쓰기</h2>
    <label className="form-label" htmlFor="review-seller">구매한 판매자</label>
    <select id="review-seller" className="form-input" value={seller} onChange={e => setSeller(e.target.value)} required><option value="">판매자 선택</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
    <label className="form-label" htmlFor="review-body">리뷰 내용</label>
    <textarea id="review-body" className="form-input" maxLength={1000} value={body} onChange={e => setBody(e.target.value)} placeholder="상품 상태, 배송, 검수 경험을 알려주세요" required/>
    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><ImagePlus size={16} className="text-primary"/>사진(최대 6장)·영상(1개) 추가<input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={e => pick(e.target.files)}/></label>
    {files.length > 0 && <p className="mt-1 text-xs text-primary">{files.length}개 파일 선택됨</p>}
    {msg && <p className="mt-2 text-xs text-muted-foreground" role="status">{msg}</p>}
    <Button variant="gold" className="mt-4 w-full" disabled={busy} type="submit">{busy ? '등록 중…' : '리뷰 등록'}</Button>
  </form>;
}
