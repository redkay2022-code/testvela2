import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Pencil, Plus, Trash2, X, Eye, EyeOff, Video, Scissors, TriangleAlert, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { publicationUpdate } from '@/lib/seller-workflows';
import { useMyAccount } from './seller-account';
import { formatMoney } from '@/lib/currency';
import { VideoEditor, type VideoTag } from './video-editor';
import { VideoStartPreview } from './video-start-preview';
import { uploadVideoThumbnail } from '@/lib/video-thumbnail';
import { isListingPhoto, isListingVideo, MAX_LISTING_PHOTOS, validateListingFiles } from '@/lib/listing-media';

type Specs = { brand?: string; model?: string; movement?: string; caseSize?: string; material?: string; waterResistance?: string; sourceType?: string; factory?: string };
type Listing = { id: string; title: string; description: string; category: string; price: number | null; box_price: number | null; media_urls: string[]; video_url: string | null; status: string; product_status?: string | null; stock_qty?: number; reserved_qty?: number; specs: Specs; video_tags?: VideoTag[]; created_at: string; signed_media_urls?: string[]; signed_video_url?: string | undefined };
type PhotoItem = { id: string; path?: string; file?: File; preview: string };
type VideoItem = { path?: string; file?: File; preview: string };
const specFields: [keyof Specs, string, string][] = [
  ['brand', '브랜드', '예: Rolex'], ['model', '모델', '예: Submariner 126610LN'], ['movement', '무브먼트', '예: VS3235 · 72시간'],
  ['caseSize', '케이스 크기', '예: 41mm'], ['material', '소재', '예: 904L 스틸'], ['waterResistance', '방수', '예: 50m / 5ATM'],
];
const factoryOptions = [
  'VS Factory (VSF)', 'ZF Factory (ZF)', '3K Factory (3KF)', 'PPF Factory (PPF)', 'APS Factory (APSF)', 'ARF Factory (ARF)',
  'GMF Factory (GMF)', 'BV Factory (BVF)', 'V7 Factory (V7F)', 'RC Factory', 'RG Factory', 'UMI Factory', 'Rich Factory',
];
type SourceType = 'custom' | 'factory' | 'other';

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
      if (!user) return [];
      const { data, error } = await supabase.from('posts').select('id,title,description,category,price,box_price,media_urls,video_url,status,product_status,stock_qty,reserved_qty,specs,video_tags,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data as unknown as Listing[];
      const paths = rows.flatMap(r => [...r.media_urls, r.video_url].filter(Boolean)) as string[];
      const thumbs = new Map<string, string>();
      if (paths.length) { const { data: signed } = await supabase.storage.from('market-media').createSignedUrls(paths, 3600); signed?.forEach(s => s.path && s.signedUrl && thumbs.set(s.path, s.signedUrl)); }
      return rows.map(r => ({ ...r, signed_media_urls: r.media_urls.map(path => thumbs.get(path) ?? ''), signed_video_url: r.video_url ? thumbs.get(r.video_url) : undefined, thumb: thumbs.get(r.media_urls[0] ?? ''), video: r.video_url ? thumbs.get(r.video_url) : undefined }));
    },
  });
  const [editing, setEditing] = useState<Listing | 'new' | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['my-listings'] }); void qc.invalidateQueries({ queryKey: ['posts'] }); };

  if (!user) return <section className="seller-flow-card"><h2 className="text-lg font-semibold">내 상품 관리</h2><p className="mt-2 text-sm text-muted-foreground">상품을 등록하려면 “나” 탭에서 로그인해 주세요.</p></section>;
  if (account.isLoading) return <section className="seller-flow-card"><p className="text-sm text-muted-foreground">계정 확인 중…</p></section>;
  if (!canSell) return <section className="seller-flow-card"><h2 className="text-lg font-semibold">내 상품 관리</h2><p className="mt-2 text-sm text-muted-foreground">승인된 셀러만 상품을 등록할 수 있어요. “나” 탭에서 셀러 계정을 신청해 주세요.</p></section>;

  const toggleSold = async (l: Listing, sold: boolean) => { await supabase.from('posts').update({ stock_qty: sold ? (l.reserved_qty ?? 0) : Math.max(1, (l.reserved_qty ?? 0) + 1) }).eq('id', l.id); refresh(); void qc.invalidateQueries({ queryKey: ['seller-stats'] }); };
  const toggle = async (l: Listing) => { const {error} = await supabase.from('posts').update(publicationUpdate(l.status !== 'published')).eq('id', l.id).eq('user_id',user.id); if(error){alert('판매 상태를 변경하지 못했습니다.');return;} refresh(); };
  const replaceVideo = async (l: Listing, file: File) => {
    if (!isListingVideo(file)) { alert('영상 파일(MP4/WEBM/MOV)을 선택해 주세요.'); return; }
    try { await validateListingFiles([file]); } catch (err) { alert(err instanceof Error ? err.message : '영상을 확인해 주세요.'); return; }
    setReplacing(l.id);
    try {
      const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: up } = await supabase.storage.from('market-media').upload(path, file);
      if (up) throw new Error('영상을 올리지 못했어요. 다시 시도해 주세요.');
      const { error: e } = await supabase.from('posts').update({ video_url: path, thumbnail_url: await uploadVideoThumbnail(file, user.id), video_tags: [], updated_at: new Date().toISOString() }).eq('id', l.id);
      if (e) { await supabase.storage.from('market-media').remove([path]); throw new Error('게시물을 수정하지 못했어요.'); }
      if (l.video_url) await supabase.storage.from('market-media').remove([l.video_url]);
      refresh();
    } catch (err) { alert(err instanceof Error ? err.message : '영상 교체에 실패했어요.'); }
    finally { setReplacing(null); }
  };
  const remove = async (l: Listing) => { if (!confirm('이 상품을 삭제할까요?')) return; await supabase.from('posts').delete().eq('id', l.id); const media = [...l.media_urls, ...(l.video_url ? [l.video_url] : [])]; if (media.length) await supabase.storage.from('market-media').remove(media); refresh(); };

  return <section className="seller-flow-card" aria-label="내 상품 관리">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">내 상품 관리</h2><Button size="sm" onClick={() => setEditing('new')}><Plus />새 상품</Button></div>
    {editing && <ListingForm user={user} catalog={(listings.data ?? []).filter(l => l.status === 'published').map(l => ({ id: l.id, title: l.title }))} listing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    {listings.isLoading ? <p className="mt-3 text-sm text-muted-foreground">불러오는 중…</p> : !listings.data?.length ? <p className="mt-3 text-sm text-muted-foreground">아직 등록한 상품이 없어요.</p> :
      <ul className="seller-inventory-grid mt-5">{listings.data.map(l => <li key={l.id} className="seller-inventory-item">
        <div className="min-w-0">{l.video ? <VideoStartPreview src={l.video} className="seller-inventory-image" /> : l.thumb ? <img src={l.thumb} alt={l.title} className="seller-inventory-image" /> : <div className="seller-inventory-image bg-muted" />}
          <div className="min-w-0"><p className="truncate font-medium">{l.title}</p><p className="text-xs text-muted-foreground">{l.price != null ? formatMoney(l.price) : '가격 없음'} · <span className="record-status">{l.product_status === 'OUT_OF_STOCK' ? '판매 완료' : l.status === 'published' ? '판매 중' : '임시 저장'}</span></p>{l.specs.factory && <span className="text-xs text-primary" data-no-translate>{l.specs.factory}</span>}{l.specs.sourceType === 'custom' && <span className="text-xs text-primary">커스텀 제작</span>}</div></div>
        <div className="record-actions">
          {l.status === 'published' && <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-primary" aria-label="판매 완료(Sold)" checked={l.product_status === 'OUT_OF_STOCK'} onChange={e => void toggleSold(l, e.target.checked)} />Sold</label>}
           <label className="flex items-center gap-2 text-xs"><Switch aria-label={`${l.title} 판매`} checked={l.status==='published'} onCheckedChange={() => void toggle(l)}/>판매</label>
          <Button size="sm" variant="ghost" aria-label="편집" onClick={() => setEditing(l)}><Pencil />편집</Button>
          <Button asChild size="sm" variant="ghost"><label aria-label="영상 재업로드" className={replacing === l.id ? 'pointer-events-none opacity-60' : 'cursor-pointer'}><RefreshCw className={replacing === l.id ? 'animate-spin' : ''} />{replacing === l.id ? '올리는 중' : '재업로드'}<input type="file" accept="video/*" className="sr-only" disabled={replacing === l.id} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void replaceVideo(l, f); }} /></label></Button>
          <Button size="sm" variant="ghost" aria-label="삭제" onClick={() => void remove(l)}><Trash2 />삭제</Button>
        </div></li>)}</ul>}
  </section>;
}

function ListingForm({ user, listing, catalog, onClose, onSaved }: { user: User; listing: Listing | null; catalog: { id: string; title: string }[]; onClose: () => void; onSaved: () => void }) {
  const [videoTags, setVideoTags] = useState<VideoTag[]>(listing?.video_tags ?? []);
  const [editing, setEditing] = useState<File | null>(null);
  const [title, setTitle] = useState(listing?.title ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [category, setCategory] = useState(listing?.category === '악세사리' ? '악세사리' : '시계');
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : '');
  const [boxPrice, setBoxPrice] = useState(listing?.box_price != null ? String(listing.box_price) : '');
  const [specs, setSpecs] = useState<Specs>(listing?.specs ?? {});
  const [sourceType, setSourceType] = useState<SourceType>(() => {
    const t = listing?.specs?.sourceType;
    return t === 'factory' || t === 'other' ? t : 'custom';
  });
  const [factory, setFactory] = useState(listing?.specs?.factory ?? '');
  const [photos, setPhotos] = useState<PhotoItem[]>(() => listing?.media_urls.map((path, index) => ({ id: `existing:${path}`, path, preview: listing.signed_media_urls?.[index] ?? '' })) ?? []);
  const [video, setVideo] = useState<VideoItem | null>(() => listing?.video_url ? { path: listing.video_url, preview: listing.signed_video_url ?? '' } : null);
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);
  const objectUrls = useRef<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => () => { objectUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);

  const createPreview = (file: File) => { const url = URL.createObjectURL(file); objectUrls.current.add(url); return url; };
  const removePhoto = (id: string) => setPhotos(current => { const item = current.find(photo => photo.id === id); if (item?.file) { URL.revokeObjectURL(item.preview); objectUrls.current.delete(item.preview); } return current.filter(photo => photo.id !== id); });
  const removeVideo = () => { if (video?.file) { URL.revokeObjectURL(video.preview); objectUrls.current.delete(video.preview); } setVideo(null); };
  const movePhoto = (id: string, offset: number) => setPhotos(current => { const from = current.findIndex(photo => photo.id === id); const to = from + offset; if (from < 0 || to < 0 || to >= current.length) return current; const next = [...current]; const [item] = next.splice(from, 1); if (!item) return current; next.splice(to, 0, item); return next; });
  const dropPhoto = (targetId: string) => { if (!draggedPhoto || draggedPhoto === targetId) return; setPhotos(current => { const from = current.findIndex(photo => photo.id === draggedPhoto); const to = current.findIndex(photo => photo.id === targetId); if (from < 0 || to < 0) return current; const next = [...current]; const [item] = next.splice(from, 1); if (!item) return current; next.splice(to, 0, item); return next; }); setDraggedPhoto(null); };

  const selectMedia = async (selected: File[]) => {
    if (!selected.length) return;
    const selectedPhotos = selected.filter(isListingPhoto);
    const selectedVideos = selected.filter(isListingVideo);
    if (photos.length + selectedPhotos.length > MAX_LISTING_PHOTOS || Number(Boolean(video)) + selectedVideos.length > 1) { setError(`사진은 최대 ${MAX_LISTING_PHOTOS}장, 영상은 1개까지 선택할 수 있어요.`); return; }
    try { await validateListingFiles(selected); }
    catch (err) { setError(err instanceof Error ? err.message : '미디어를 확인해 주세요.'); return; }
    if (selectedVideos[0]) { setVideo({ file: selectedVideos[0], preview: createPreview(selectedVideos[0]) }); setEditing(selectedVideos[0]); }
    setPhotos(current => [...current, ...selectedPhotos.map(file => ({ id: crypto.randomUUID(), file, preview: createPreview(file) }))]);
    setError('');
  };

  const save = async (status: 'draft' | 'published') => {
    if (!title.trim()) { setError('상품명을 입력해 주세요.'); return; }
    const p = Number(price); if (!Number.isFinite(p) || p < 1) { setError('판매 가격(USD)을 입력해 주세요.'); return; }
    if (photos.length === 0 && !video) { setError('사진 또는 영상을 1개 이상 추가해 주세요.'); return; }
    if (sourceType === 'factory' && !factory) { setError('공장을 선택해 주세요.'); return; }
    if (sourceType === 'other' && !factory.trim()) { setError('출처 / 공장을 직접 입력해 주세요.'); return; }
    setError(''); setPending(true);
    const uploaded: string[] = [];
    try {
      let nextVideo = video?.path ?? null;
      let nextThumb: string | null | undefined = video?.file ? null : undefined;
      if (video?.file) { const ext = video.file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4'; const path = `${user.id}/${crypto.randomUUID()}.${ext}`; const { error: e } = await supabase.storage.from('market-media').upload(path, video.file); if (e) throw new Error('영상을 올리지 못했어요. 다시 시도해 주세요.'); uploaded.push(path); nextVideo = path; nextThumb = await uploadVideoThumbnail(video.file, user.id); if (nextThumb) uploaded.push(nextThumb); }
      const photoPaths: string[] = [];
      for (const photo of photos) {
        if (photo.path) { photoPaths.push(photo.path); continue; }
        if (!photo.file) continue;
        const ext = photo.file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: e } = await supabase.storage.from('market-media').upload(path, photo.file);
        if (e) throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.');
        uploaded.push(path); photoPaths.push(path);
      }
      const cleanSpecs = Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, String(v ?? '').trim().slice(0, 80)]).filter(([, v]) => v));
      cleanSpecs.sourceType = sourceType;
      if (sourceType === 'custom') delete cleanSpecs.factory;
      else cleanSpecs.factory = factory.trim().slice(0, 80);
      const row = { title: title.trim().slice(0, 100), description: description.trim().slice(0, 3000), category, price: Math.round(p), box_price: boxPrice ? Math.round(Number(boxPrice)) : null, media_urls: photoPaths, video_url: nextVideo, ...(nextThumb !== undefined || !nextVideo ? { thumbnail_url: nextVideo ? nextThumb ?? null : null } : {}), video_tags: nextVideo ? videoTags : [], specs: cleanSpecs, status, updated_at: new Date().toISOString() };
      if (listing) {
        const { error: e } = await supabase.from('posts').update(row).eq('id', listing.id); if (e) throw new Error('저장하지 못했어요.');
        const retained = new Set(photoPaths); const removed = [...listing.media_urls.filter(path => !retained.has(path)), ...(listing.video_url && listing.video_url !== nextVideo ? [listing.video_url] : [])]; if (removed.length) await supabase.storage.from('market-media').remove(removed);
      } else {
        const nickname = (await supabase.from('profiles').select('nickname').eq('user_id', user.id).maybeSingle()).data?.nickname || 'vela member';
        const { error: e } = await supabase.from('posts').insert({ ...row, user_id: user.id, creator: nickname.slice(0, 40), image_key: 'uploaded' });
        if (e) throw new Error('저장하지 못했어요. 셀러 승인 상태를 확인해 주세요.');
      }
      onSaved();
    } catch (err) { if (uploaded.length) await supabase.storage.from('market-media').remove(uploaded); setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.'); }
    finally { setPending(false); }
  };

  const photoPicker = useRef<HTMLInputElement>(null);
  const photoTotal = photos.length;
  return <div className="form-panel mt-4 rounded-lg border border-border p-4">
    {editing && <VideoEditor file={editing} catalog={catalog.filter(c => c.id !== listing?.id)} onCancel={() => setEditing(null)} onDone={({ file, tags }) => { if (video?.file) { URL.revokeObjectURL(video.preview); objectUrls.current.delete(video.preview); } setVideo({ file, preview: createPreview(file) }); setVideoTags(tags); setEditing(null); }} />}
    <div className="flex items-center justify-between"><h3 className="font-semibold">{listing ? '상품 수정' : '새 상품 등록'}</h3><Button size="icon" variant="ghost" aria-label="닫기" onClick={onClose}><X /></Button></div>
    <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-muted p-4"><span className="flex gap-2 text-primary"><Video/><ImagePlus/></span><span className="text-sm text-muted-foreground">영상과 사진 한 번에 선택</span><span className="text-xs text-muted-foreground">영상 1개 · 30초 · 100MB · 사진 10MB / 사진 {photoTotal}/{MAX_LISTING_PHOTOS}</span>
      <input className="sr-only" type="file" accept="image/*,video/*" multiple aria-label="상품 영상과 사진 한 번에 선택" onChange={e => { const selected = Array.from(e.target.files || []); e.target.value = ''; void selectMedia(selected); }} /></label>
    {(video || photos.length > 0) && <div className="mt-3 space-y-3" aria-label="선택한 상품 미디어">
      {video && <div className="grid grid-cols-2 gap-2"><div className="relative overflow-hidden rounded-md border border-primary bg-muted"><VideoStartPreview file={video.file} src={video.preview} className="aspect-square w-full object-cover"/><span className="absolute left-2 top-2 rounded bg-background/80 px-2 py-1 text-[11px] font-semibold text-primary">메인 피드 영상</span><Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 size-7" aria-label="영상 제거" onClick={removeVideo}><X /></Button>{video.file && <Button type="button" size="sm" variant="gold" className="absolute bottom-2 right-2" onClick={() => { if (video.file) setEditing(video.file); }}><Scissors />영상 편집</Button>}{videoTags.length > 0 && <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-[11px] text-primary">상품 태그 {videoTags.length}개</span>}</div>{photoTotal < MAX_LISTING_PHOTOS && <Button type="button" variant="outline" className="aspect-square h-auto w-full flex-col gap-2 border-dashed border-primary/50 bg-muted text-primary" aria-label="사진 추가" onClick={() => photoPicker.current?.click()}><ImagePlus className="size-7"/><span className="text-xs">사진 추가</span><span className="text-[11px] text-muted-foreground">{photoTotal}/{MAX_LISTING_PHOTOS}</span></Button>}</div>}
      {photos.length > 0 && <div><p className="mb-2 text-xs text-muted-foreground">상세 사진 갤러리 · 끌어서 또는 화살표로 순서 변경</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => <div key={photo.id} draggable onDragStart={() => setDraggedPhoto(photo.id)} onDragEnd={() => setDraggedPhoto(null)} onDragOver={event => event.preventDefault()} onDrop={() => dropPhoto(photo.id)} className={`relative overflow-hidden rounded-md border bg-muted ${draggedPhoto === photo.id ? 'border-primary opacity-60' : 'border-border'}`}>
          {photo.preview ? <img src={photo.preview} alt={`상세 사진 ${index + 1}`} className="aspect-square w-full object-cover"/> : <div className="grid aspect-square place-items-center text-xs text-muted-foreground">사진 {index + 1}</div>}
          <span className="absolute left-1 top-1 grid size-6 place-items-center rounded bg-background/80 text-[10px] font-semibold">{index + 1}</span><GripVertical className="absolute bottom-1 left-1 size-5 rounded bg-background/80 p-0.5 text-muted-foreground" aria-hidden="true"/>
          <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 size-6" aria-label={`상세 사진 ${index + 1} 제거`} onClick={() => removePhoto(photo.id)}><X /></Button>
          <div className="absolute bottom-1 right-1 flex gap-1"><Button type="button" size="icon" variant="secondary" className="size-6" disabled={index === 0} aria-label={`상세 사진 ${index + 1} 앞으로 이동`} onClick={() => movePhoto(photo.id, -1)}><ArrowLeft /></Button><Button type="button" size="icon" variant="secondary" className="size-6" disabled={index === photos.length - 1} aria-label={`상세 사진 ${index + 1} 뒤로 이동`} onClick={() => movePhoto(photo.id, 1)}><ArrowRight /></Button></div>
        </div>)}
      </div></div>}
    </div>}
    <input ref={photoPicker} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="추가 사진 선택" onChange={e => { const selected = Array.from(e.target.files || []); e.target.value = ''; void selectMedia(selected); }} />
    <label htmlFor="l-title" className="form-label">상품명</label><input id="l-title" className="form-input" maxLength={100} value={title} onChange={e => setTitle(e.target.value)} />
    <label htmlFor="l-cat" className="form-label">카테고리</label><select id="l-cat" className="form-input" value={category} onChange={e => setCategory(e.target.value)}><option value="시계">시계</option><option value="악세사리">악세사리</option></select>
    <div className="grid grid-cols-2 gap-x-3">{specFields.map(([k, label, ph]) => <div key={k}><label htmlFor={`l-${k}`} className="form-label">{label}</label><input id={`l-${k}`} className="form-input" placeholder={ph} maxLength={80} value={specs[k] ?? ''} onChange={e => setSpecs(s => ({ ...s, [k]: e.target.value }))} /></div>)}</div>
    <label htmlFor="l-desc" className="form-label">상품 설명</label><textarea id="l-desc" className="form-input min-h-24" maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} />
    <div className="grid grid-cols-2 gap-x-3">
      <div><label htmlFor="l-price" className="form-label">판매 가격 (USD $)</label><input id="l-price" className="form-input" type="number" min={1} inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} /></div>
      <div><label htmlFor="l-box" className="form-label">풀셋 박스 (USD $, 선택)</label><input id="l-box" className="form-input" type="number" min={0} inputMode="numeric" value={boxPrice} onChange={e => setBoxPrice(e.target.value)} /></div>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">가격은 USD로 저장되며, 구매자에게는 각자의 통화로 자동 환산되어 표시돼요.{price && Number(price) > 0 ? ` (현재 표시: ${formatMoney(Number(price))})` : ''}</p>
    <div className="mt-1">
      <div className="form-label">제조 / 출처 구분 (Source & Factory)</div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3" role="note">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-relaxed text-destructive">⚠️ [경고] 허위 공장 표기 또는 출처 정보 도용 적발 시, 예고 없이 상품 삭제 및 셀러 자격이 영구 박탈될 수 있으며 에스크로 정산이 동결 조치됩니다.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Listing false factory information will result in immediate seller ban and escrow freeze.</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="제조 / 출처 구분 (Source & Factory)" className="mt-3 grid grid-cols-3 gap-2">
        {([['custom', '커스텀 제작'], ['factory', '공장 선택'], ['other', '기타 - 직접입력']] as const).map(([value, label]) => (
          <label key={value} className={`flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-center text-xs font-medium transition-colors ${sourceType === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            <input type="radio" name="sourceType" className="sr-only" checked={sourceType === value} onChange={() => { setSourceType(value); setFactory(''); }} />
            {label}
          </label>
        ))}
      </div>
      {sourceType === 'factory' && <select aria-label="공장 선택" className="form-input mt-2" value={factory} onChange={e => setFactory(e.target.value)}><option value="">공장을 선택해 주세요</option>{factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}</select>}
      {sourceType === 'other' && <input aria-label="출처 직접 입력" className="form-input mt-2" placeholder="출처 / 공장을 직접 입력해 주세요" maxLength={80} value={factory} onChange={e => setFactory(e.target.value)} />}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" disabled={pending} onClick={() => void save('draft')}>임시 저장</Button><Button disabled={pending} onClick={() => void save('published')}>{pending ? '저장 중…' : '게시하기'}</Button></div>
  </div>;
}
