import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { ImagePlus, Pencil, Plus, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useMyAccount } from './seller-account';
import { formatMoney } from '@/lib/currency';

type Specs = { brand?: string; model?: string; movement?: string; caseSize?: string; material?: string; waterResistance?: string };
type Listing = { id: string; title: string; description: string; category: string; price: number | null; box_price: number | null; media_urls: string[]; status: string; specs: Specs; created_at: string };
const specFields: [keyof Specs, string, string][] = [
  ['brand', '브랜드', '예: Rolex'], ['model', '모델', '예: Submariner 126610LN'], ['movement', '무브먼트', '예: VS3235 · 72시간'],
  ['caseSize', '케이스 크기', '예: 41mm'], ['material', '소재', '예: 904L 스틸'], ['waterResistance', '방수', '예: 50m / 5ATM'],
];
const MAX_PHOTOS = 15;

export function SellerListings() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setUser(data.user)); const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null)); return () => subscription.unsubscribe(); }, []);
  const account = useMyAccount(user);
  const roles: string[] = (account.data as { roles?: string[] } | undefined)?.roles ?? [];
  const canSell = roles.includes('seller') || roles.includes('admin');
  const qc = useQueryClient();
  const listings = useQuery({
    queryKey: ['my-listings', user?.id], enabled: !!user && canSell,
    queryFn: async () => {
      const { data, error } = await supabase.from('posts').select('id,title,description,category,price,box_price,media_urls,status,specs,created_at').eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data as unknown as Listing[];
      const paths = rows.map(r => r.media_urls[0]).filter(Boolean) as string[];
      const thumbs = new Map<string, string>();
      if (paths.length) { const { data: signed } = await supabase.storage.from('market-media').createSignedUrls(paths, 3600); signed?.forEach(s => s.path && s.signedUrl && thumbs.set(s.path, s.signedUrl)); }
      return rows.map(r => ({ ...r, thumb: thumbs.get(r.media_urls[0] ?? '') }));
    },
  });
  const [editing, setEditing] = useState<Listing | 'new' | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['my-listings'] }); void qc.invalidateQueries({ queryKey: ['posts'] }); };

  if (!user) return <section className="seller-flow-card"><h2 className="text-lg font-semibold">내 상품 관리</h2><p className="mt-2 text-sm text-muted-foreground">상품을 등록하려면 “나” 탭에서 로그인해 주세요.</p></section>;
  if (account.isLoading) return <section className="seller-flow-card"><p className="text-sm text-muted-foreground">계정 확인 중…</p></section>;
  if (!canSell) return <section className="seller-flow-card"><h2 className="text-lg font-semibold">내 상품 관리</h2><p className="mt-2 text-sm text-muted-foreground">승인된 셀러만 상품을 등록할 수 있어요. “나” 탭에서 셀러 계정을 신청해 주세요.</p></section>;

  const toggle = async (l: Listing) => { await supabase.from('posts').update({ status: l.status === 'published' ? 'draft' : 'published', updated_at: new Date().toISOString() }).eq('id', l.id); refresh(); };
  const remove = async (l: Listing) => { if (!confirm('이 상품을 삭제할까요?')) return; await supabase.from('posts').delete().eq('id', l.id); if (l.media_urls.length) await supabase.storage.from('market-media').remove(l.media_urls); refresh(); };

  return <section className="seller-flow-card" aria-label="내 상품 관리">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">내 상품 관리</h2><Button size="sm" onClick={() => setEditing('new')}><Plus />새 상품</Button></div>
    {editing && <ListingForm user={user} listing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    {listings.isLoading ? <p className="mt-3 text-sm text-muted-foreground">불러오는 중…</p> : !listings.data?.length ? <p className="mt-3 text-sm text-muted-foreground">아직 등록한 상품이 없어요.</p> :
      <ul className="management-list mt-3">{listings.data.map(l => <li key={l.id} className="management-row">
        <div className="flex min-w-0 items-center gap-3">{l.thumb ? <img src={l.thumb} alt="" className="size-12 shrink-0 rounded-md object-cover" /> : <div className="size-12 shrink-0 rounded-md bg-muted" />}
          <div className="min-w-0"><p className="truncate font-medium">{l.title}</p><p className="text-xs text-muted-foreground">{l.price != null ? formatMoney(l.price) : '가격 없음'} · <span className="record-status">{l.status === 'published' ? '판매 중' : '임시 저장'}</span></p></div></div>
        <div className="record-actions">
          <Button size="icon" variant="ghost" aria-label={l.status === 'published' ? '비공개로 전환' : '게시하기'} onClick={() => void toggle(l)}>{l.status === 'published' ? <EyeOff /> : <Eye />}</Button>
          <Button size="icon" variant="ghost" aria-label="수정" onClick={() => setEditing(l)}><Pencil /></Button>
          <Button size="icon" variant="ghost" aria-label="삭제" onClick={() => void remove(l)}><Trash2 /></Button>
        </div></li>)}</ul>}
  </section>;
}

function ListingForm({ user, listing, onClose, onSaved }: { user: User; listing: Listing | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(listing?.title ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [category, setCategory] = useState(listing?.category === '악세사리' ? '악세사리' : '시계');
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : '');
  const [boxPrice, setBoxPrice] = useState(listing?.box_price != null ? String(listing.box_price) : '');
  const [specs, setSpecs] = useState<Specs>(listing?.specs ?? {});
  const [kept, setKept] = useState<string[]>(listing?.media_urls ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => { const u = files.map(f => URL.createObjectURL(f)); setPreviews(u); return () => u.forEach(x => URL.revokeObjectURL(x)); }, [files]);

  const save = async (status: 'draft' | 'published') => {
    if (!title.trim()) { setError('상품명을 입력해 주세요.'); return; }
    const p = Number(price); if (!Number.isFinite(p) || p < 1) { setError('판매 가격(USD)을 입력해 주세요.'); return; }
    if (kept.length + files.length === 0) { setError('사진을 1장 이상 추가해 주세요.'); return; }
    if (files.some(f => f.size > 25 * 1024 * 1024)) { setError('파일당 최대 25MB까지 올릴 수 있어요.'); return; }
    setError(''); setPending(true);
    const uploaded: string[] = [];
    try {
      for (const f of files) {
        const ext = f.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: e } = await supabase.storage.from('market-media').upload(path, f);
        if (e) throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.');
        uploaded.push(path);
      }
      const cleanSpecs = Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, String(v ?? '').trim().slice(0, 80)]).filter(([, v]) => v));
      const row = { title: title.trim().slice(0, 100), description: description.trim().slice(0, 3000), category, price: Math.round(p), box_price: boxPrice ? Math.round(Number(boxPrice)) : null, media_urls: [...kept, ...uploaded], specs: cleanSpecs, status, updated_at: new Date().toISOString() };
      if (listing) {
        const { error: e } = await supabase.from('posts').update(row).eq('id', listing.id); if (e) throw new Error('저장하지 못했어요.');
        const removed = listing.media_urls.filter(m => !kept.includes(m)); if (removed.length) await supabase.storage.from('market-media').remove(removed);
      } else {
        const nickname = (await supabase.from('profiles').select('nickname').eq('user_id', user.id).maybeSingle()).data?.nickname || 'vela member';
        const { error: e } = await supabase.from('posts').insert({ ...row, user_id: user.id, creator: nickname.slice(0, 40), image_key: 'uploaded' });
        if (e) throw new Error('저장하지 못했어요. 셀러 승인 상태를 확인해 주세요.');
      }
      onSaved();
    } catch (err) { if (uploaded.length) await supabase.storage.from('market-media').remove(uploaded); setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.'); }
    finally { setPending(false); }
  };

  const total = kept.length + files.length;
  return <div className="form-panel mt-4 rounded-lg border border-border p-4">
    <div className="flex items-center justify-between"><h3 className="font-semibold">{listing ? '상품 수정' : '새 상품 등록'}</h3><Button size="icon" variant="ghost" aria-label="닫기" onClick={onClose}><X /></Button></div>
    <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-muted p-4"><ImagePlus className="text-primary" /><span className="text-sm text-muted-foreground">사진 추가 ({total}/{MAX_PHOTOS})</span>
      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="상품 사진 선택" onChange={e => { const s = Array.from(e.target.files || []); if (total + s.length > MAX_PHOTOS) { setError(`사진은 최대 ${MAX_PHOTOS}장까지예요.`); return; } setFiles(prev => [...prev, ...s]); e.target.value = ''; }} /></label>
    {(kept.length > 0 || previews.length > 0) && <div className="mt-3 grid grid-cols-4 gap-2">
      {kept.map((m, i) => <div key={m} className="relative flex aspect-square items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">기존 {i + 1}<Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 size-6" aria-label="기존 사진 제거" onClick={() => setKept(k => k.filter(x => x !== m))}><X /></Button></div>)}
      {previews.map((src, i) => <div key={src} className="relative"><img src={src} alt={`새 사진 ${i + 1}`} className="aspect-square w-full rounded-md object-cover" /><Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 size-6" aria-label="새 사진 제거" onClick={() => setFiles(f => f.filter((_, j) => j !== i))}><X /></Button></div>)}
    </div>}
    <label htmlFor="l-title" className="form-label">상품명</label><input id="l-title" className="form-input" maxLength={100} value={title} onChange={e => setTitle(e.target.value)} />
    <label htmlFor="l-cat" className="form-label">카테고리</label><select id="l-cat" className="form-input" value={category} onChange={e => setCategory(e.target.value)}><option value="시계">시계</option><option value="악세사리">악세사리</option></select>
    <div className="grid grid-cols-2 gap-x-3">{specFields.map(([k, label, ph]) => <div key={k}><label htmlFor={`l-${k}`} className="form-label">{label}</label><input id={`l-${k}`} className="form-input" placeholder={ph} maxLength={80} value={specs[k] ?? ''} onChange={e => setSpecs(s => ({ ...s, [k]: e.target.value }))} /></div>)}</div>
    <label htmlFor="l-desc" className="form-label">상품 설명</label><textarea id="l-desc" className="form-input min-h-24" maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} />
    <div className="grid grid-cols-2 gap-x-3">
      <div><label htmlFor="l-price" className="form-label">판매 가격 (USD $)</label><input id="l-price" className="form-input" type="number" min={1} inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} /></div>
      <div><label htmlFor="l-box" className="form-label">풀셋 박스 (USD $, 선택)</label><input id="l-box" className="form-input" type="number" min={0} inputMode="numeric" value={boxPrice} onChange={e => setBoxPrice(e.target.value)} /></div>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">가격은 USD로 저장되며, 구매자에게는 각자의 통화로 자동 환산되어 표시돼요.{price && Number(price) > 0 ? ` (현재 표시: ${formatMoney(Number(price))})` : ''}</p>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" disabled={pending} onClick={() => void save('draft')}>임시 저장</Button><Button disabled={pending} onClick={() => void save('published')}>{pending ? '저장 중…' : '게시하기'}</Button></div>
  </div>;
}
