import { tx } from '@/lib/dom-translate';
import { cardPathOf, uploadCardImage } from '@/lib/card-image';
import { CardImageOptimizer } from './card-image-optimizer';
import { useCurrency } from './currency';
import { activeLang } from '@/lib/i18n';
import { WatchSpecificationsForm } from './watch-specifications-form';
import { cleanWatchSpecs } from '@/lib/watch-specifications';
import { postCategoryLabels } from '@/lib/feed-categories';
import { PostCategoryField } from './post-category-field';
import { dispatchValue } from '@/lib/dispatch';
import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { syncMyPostNickname } from '@/lib/seller-accounts.functions';
import { signMyMedia } from '@/lib/my-media.functions';
import { removeMarketMedia } from '@/lib/proxy-seller.functions';
import { useLeaveWarning } from '@/lib/leave-warning';
import { boxPriceOrDefault } from '@/lib/box-price';
import { putMarketMedia, removeMarketFiles } from '@/lib/market-upload';
import { MemberPicker, PROXY_NOT_SELLER_MESSAGE, type ProxyTarget } from './member-picker';
import { ListingPreview } from './listing-preview';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Pencil, Plus, Trash2, X, Eye, EyeOff, Video, Scissors, TriangleAlert, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { publicationUpdate } from '@/lib/seller-workflows';
import { useMyAccount } from './seller-account';
import { useAdminPasswordGate } from './admin-password-gate';
import { formatMoney } from '@/lib/currency';
import { VideoEditor, type VideoTag } from './video-editor';
import { VideoStartPreview } from './video-start-preview';
import { uploadVideoThumbnail } from '@/lib/video-thumbnail';
import { compressImage, LONG_CACHE } from '@/lib/image-compress';
import { compressVideoForWeb, COMPRESS_THRESHOLD_BYTES } from '@/lib/video-compress';
import { estimateUploadSeconds, useCountdown } from '@/lib/upload-countdown';
import { BulkUpload } from './bulk-upload';
import { DispatchSelect } from './dispatch-select';
import { type SourceType } from './source-factory';
import { SourceFactorySelect } from './source-factory-select';
import { isListingPhoto, isListingVideo, MAX_LISTING_PHOTOS, MAX_VIDEO_BYTES, photoTooLarge, readVideoDuration, validateListingFiles } from '@/lib/listing-media';

type Specs = Record<string, string> & { sourceType?: string; factory?: string };
type Listing = { id: string; title: string; description: string; category: string; price: number | null; box_price: number | null; dispatch_time?: string | null; media_urls: string[]; video_url: string | null; status: string; product_status?: string | null; stock_qty?: number; reserved_qty?: number; specs: Specs; video_tags?: VideoTag[]; created_at: string; thumbnail_url?: string | null; thumb?: string; signed_media_urls?: string[]; signed_video_url?: string | undefined };
type PhotoItem = { id: string; path?: string; file?: File; preview: string };
type VideoItem = { path?: string; file?: File; preview: string };

export function SellerListings({ actAs }: { actAs?: ProxyTarget | null } = {}) {
  const { lang } = useCurrency();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setUser(data.user)); const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null)); return () => subscription.unsubscribe(); }, []);
  const account = useMyAccount(user);
  const gate = useAdminPasswordGate();
  const roles: string[] = (account.data as { roles?: string[] } | undefined)?.roles ?? [];
  const canSell = roles.includes('seller') || roles.includes('admin');
  const qc = useQueryClient();
  const syncNickname = useServerFn(syncMyPostNickname);
  const signMedia = useServerFn(signMyMedia);
  const [picked, setActing] = useState<ProxyTarget | null>(null);
  const acting = actAs ?? picked;
  const synced = useRef(false);
  useEffect(() => { if (!user || !canSell || synced.current) return; synced.current = true; void syncNickname().then(() => qc.invalidateQueries({ queryKey: ['my-listings'] })).catch(() => undefined); }, [user, canSell]);
  const listings = useQuery({
    queryKey: ['my-listings', acting?.id ?? user?.id], enabled: !!user && canSell,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('posts').select('id,title,description,category,price,box_price,dispatch_time,media_urls,video_url,status,product_status,stock_qty,reserved_qty,specs,video_tags,created_at,thumbnail_url').eq('user_id', acting?.id ?? user.id).order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data as unknown as Listing[];
      // 목록에는 상품당 대표 사진 1장만 서명한다. 서버에서 소유자를 확인해 서명하고(스토리지 정책 밖 파일도 보이도록), 실패하면 브라우저에서 직접 시도한다.
      const serverThumbs = new Map<string, string>();
      for (let i = 0; i < rows.length; i += 100) {
        try { const res = await signMedia({ data: { ids: rows.slice(i, i + 100).map(r => r.id), ...(acting ? { ownerId: acting.id } : {}) } }); Object.entries(res).forEach(([id, v]) => { if (v.thumb) serverThumbs.set(id, v.thumb); }); } catch { /* 아래 직접 서명으로 보완 */ }
      }
      const pick = (r: Listing) => cardPathOf(r.specs) || r.media_urls[0] || r.thumbnail_url || '';
      const paths = [...new Set(rows.filter(r => !serverThumbs.has(r.id)).map(pick).filter(Boolean))];
      const thumbs = new Map<string, string>();
      for (let i = 0; i < paths.length; i += 100) {
        try {
          const { data: signed } = await supabase.storage.from('market-media').createSignedUrls(paths.slice(i, i + 100), 3600);
          signed?.forEach(s => s.path && s.signedUrl && thumbs.set(s.path, s.signedUrl));
        } catch { /* 일부 사진만 못 불러와도 목록은 표시 */ }
      }
      return rows.map(r => ({ ...r, thumb: serverThumbs.get(r.id) ?? thumbs.get(pick(r)) }));
    },
  });
  const [editing, setEditing] = useState<Listing | 'new' | null>(null);
  const [bulk, setBulk] = useState(false);
  const [shown, setShown] = useState(24);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<Listing | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  // 목록은 가볍게 대표 사진만 서명하므로, 미리보기·편집을 열 때 해당 상품의 사진·영상을 그때 서명한다.
  const openWithMedia = async (l: Listing, open: (value: Listing) => void) => {
    if (opening) return; setOpening(l.id);
    try {
      try { const res = (await signMedia({ data: { ids: [l.id], full: true, ...(acting ? { ownerId: acting.id } : {}) } }))[l.id]; if (res && (res.media.some(Boolean) || res.video)) { open({ ...l, signed_media_urls: res.media, signed_video_url: res.video || undefined }); return; } } catch { /* 직접 서명으로 보완 */ }
      const paths = [...l.media_urls, l.video_url].filter(Boolean) as string[]; const map = new Map<string, string>();
      for (let i = 0; i < paths.length; i += 100) { try { const { data: signed } = await supabase.storage.from('market-media').createSignedUrls(paths.slice(i, i + 100), 3600); signed?.forEach(x => x.path && x.signedUrl && map.set(x.path, x.signedUrl)); } catch { /* 일부 실패해도 열기 */ } }
      open({ ...l, signed_media_urls: l.media_urls.map(p => map.get(p) ?? ''), signed_video_url: l.video_url ? map.get(l.video_url) : undefined });
    } finally { setOpening(null); }
  };
  const formTop = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editing) formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [editing]);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['my-listings'] }); void qc.invalidateQueries({ queryKey: ['posts'] }); void qc.invalidateQueries({ queryKey: ['my-listing-count'] }); };

  if (!user) return <section className="seller-flow-card"><h2 className="text-lg font-semibold"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("내 상품 관리")}</span></h2><p className="mt-2 text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("상품을 등록하려면 “나” 탭에서 로그인해 주세요.")}</span></p></section>;
  if (account.isLoading) return <section className="seller-flow-card"><p className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("계정 확인 중…")}</span></p></section>;
  if (!canSell) return <section className="seller-flow-card"><h2 className="text-lg font-semibold"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("내 상품 관리")}</span></h2><p className="mt-2 text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("승인된 셀러만 상품을 등록할 수 있어요. “나” 탭에서 셀러 계정을 신청해 주세요.")}</span></p></section>;

  const toggleSold = async (l: Listing, sold: boolean) => { const {error}=await supabase.from('posts').update({ stock_qty: sold ? (l.reserved_qty ?? 0) : Math.max(1, (l.reserved_qty ?? 0) + 1) }).eq('id', l.id).eq('user_id',acting?.id ?? user.id); if(error){alert('판매 완료 상태를 변경하지 못했습니다.');return;} refresh(); void qc.invalidateQueries({ queryKey: ['seller-stats'] }); };
  const toggle = async (l: Listing) => { const {error} = await supabase.from('posts').update(publicationUpdate(l.status !== 'published')).eq('id', l.id).eq('user_id',acting?.id ?? user.id); if(error){alert('판매 상태를 변경하지 못했습니다.');return;} refresh(); };
  const replaceVideo = async (l: Listing, original: File) => {
    let file = original;
    if (!isListingVideo(file)) { alert('영상 파일(MP4/WEBM/MOV)을 선택해 주세요.'); return; }
    try { await validateListingFiles([file]); } catch (err) { alert(err instanceof Error ? err.message : '영상을 확인해 주세요.'); return; }
    setReplacing(l.id);
    try {
      file = await compressVideoForWeb(file);
      const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
      const folder = acting?.id ?? user.id;
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: up } = await putMarketMedia(path, file, { cacheControl: LONG_CACHE });
      if (up) throw new Error('영상을 올리지 못했어요. 다시 시도해 주세요.');
      const { error: e } = await supabase.from('posts').update({ video_url: path, thumbnail_url: await uploadVideoThumbnail(file, folder), video_tags: [], updated_at: new Date().toISOString() }).eq('id', l.id);
      if (e) { await removeMarketFiles([path]); throw new Error('게시물을 수정하지 못했어요.'); }
      if (l.video_url) await (acting ? removeMarketMedia({ data: { paths: [l.video_url] } }).catch(() => undefined) : supabase.storage.from('market-media').remove([l.video_url]));
      refresh();
    } catch (err) { alert(err instanceof Error ? err.message : '영상 교체에 실패했어요.'); }
    finally { setReplacing(null); }
  };
  const remove = async (l: Listing) => { if (roles.includes('admin')) { if (!(await gate.ask(tx('상품과 사진·영상을 함께 삭제합니다: {0}', { 0: l.title })))) return; } else if (!confirm('이 상품을 삭제할까요?')) return; await supabase.from('posts').delete().eq('id', l.id); const media = [...l.media_urls, ...(l.video_url ? [l.video_url] : []), ...(cardPathOf(l.specs) ? [cardPathOf(l.specs) as string] : [])]; if (media.length) await (acting ? removeMarketMedia({ data: { paths: media } }).catch(() => undefined) : supabase.storage.from('market-media').remove(media)); refresh(); };

  return <section className="seller-flow-card" aria-label={tx("내 상품 관리")}>{gate.dialog}
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("내 상품 관리")}</span></h2><div className="flex gap-2">{!acting && <Button size="sm" variant="goldOutline" onClick={() => setBulk(b => !b)}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("일괄 업로드")}</span></Button>}<Button size="sm" onClick={() => setEditing('new')}><Plus /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("새 상품")}</span></Button></div></div>
    {!actAs && <MemberPicker userId={user.id} value={acting} onChange={next => { setActing(next); setEditing(null); setPreviewing(null); setBulk(false); setShown(24); }} />}
    {bulk && !acting && <BulkUpload user={user} existingTitles={(listings.data ?? []).map(l => l.title)} onClose={() => setBulk(false)} onDone={refresh} />}
    {!acting && <CardImageOptimizer user={user} listings={listings.data ?? []} onDone={refresh} />}
    <div ref={formTop} className="scroll-mt-4" />
    {editing && <ListingForm user={user} owner={acting} catalog={(listings.data ?? []).filter(l => l.status === 'published').map(l => ({ id: l.id, title: l.title }))} listing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    {listings.isLoading ? <p className="mt-3 text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("불러오는 중…")}</span></p> : !listings.data?.length ? <p className="mt-3 text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("아직 등록한 상품이 없어요.")}</span></p> :
      <ul className="seller-inventory-grid mt-5">{listings.data.slice(0, shown).map(l => <li key={l.id} className="seller-inventory-item">
        <div className="min-w-0"><figure className={`seller-inventory-media ${l.product_status==='OUT_OF_STOCK'?'is-sold-out':''}`}>{l.thumb ? <img src={l.thumb} alt={l.title} loading="lazy" decoding="async" className="seller-inventory-image" /> : <div className="seller-inventory-image bg-muted" />}{l.product_status==='OUT_OF_STOCK'&&<span className="lux-soldout" data-no-translate>SOLD OUT</span>}</figure>
          <div className="min-w-0"><p className="truncate font-medium">{l.title}</p><p className="text-xs text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{l.price != null ? formatMoney(l.price) : tx('가격 없음')}</span> · <span className="record-status"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{l.product_status === 'OUT_OF_STOCK' ? tx('판매 완료') : l.status === 'published' ? tx('판매 중') : tx('임시 저장')}</span></span></p>{l.specs.factory && <span className="text-xs text-primary" data-no-translate>{l.specs.factory}</span>}{l.specs.sourceType === 'custom' && <span className="text-xs text-primary"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("커스텀 제작")}</span></span>}</div></div>
        <div className="record-actions">
          {l.status === 'published' && <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-primary" aria-label={tx("판매 완료")} checked={l.product_status === 'OUT_OF_STOCK'} onChange={e => void toggleSold(l, e.target.checked)} /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("판매 완료")}</span></label>}
           <label className="flex items-center gap-2 text-xs"><Switch aria-label={tx("{0} 판매", { 0: l.title })} checked={l.status==='published'} onCheckedChange={() => void toggle(l)}/><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("판매")}</span></label>
          <Button size="sm" variant="ghost" aria-label={tx("미리보기")} onClick={() => void openWithMedia(l, setPreviewing)}><Eye /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("미리보기")}</span></Button>
          <Button size="sm" variant="ghost" aria-label={tx("편집")} onClick={() => void openWithMedia(l, setEditing)}><Pencil /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("편집")}</span></Button>
          <Button asChild size="sm" variant="ghost"><label aria-label={tx("영상 재업로드")} className={replacing === l.id ? 'pointer-events-none opacity-60' : 'cursor-pointer'}><RefreshCw className={replacing === l.id ? 'animate-spin' : ''} /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{replacing === l.id ? tx('올리는 중') : tx('재업로드')}</span><input type="file" accept="video/*" className="sr-only" disabled={replacing === l.id} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void replaceVideo(l, f); }} /></label></Button>
          <Button size="sm" variant="ghost" aria-label={tx("삭제")} onClick={() => void remove(l)}><Trash2 /><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("삭제")}</span></Button>
        </div></li>)}</ul>}
    {(listings.data?.length ?? 0) > shown && <div className="mt-4 text-center"><Button variant="outline" onClick={() => setShown(n => n + 24)}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("더 보기")} ({shown}/{listings.data?.length})</span></Button></div>}
  {previewing && (() => { return <ListingPreview listing={previewing} user={user} onClose={() => setPreviewing(null)} />; })()}
  </section>;
}

function ListingForm({ user, owner, listing, catalog, onClose, onSaved }: { user: User; owner?: ProxyTarget | null; listing: Listing | null; catalog: { id: string; title: string }[]; onClose: () => void; onSaved: () => void }) {
  const { lang } = useCurrency();
  const [videoTags, setVideoTags] = useState<VideoTag[]>(listing?.video_tags ?? []);
  const [editing, setEditing] = useState<File | null>(null);
  const [title, setTitle] = useState(listing?.title ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [category, setCategory] = useState(listing?.category === '악세사리' ? '악세사리' : '시계');
  const [menuCategory, setMenuCategory] = useState(postCategoryLabels.includes(String(listing?.specs?.['menuCategory'] ?? '')) ? String(listing?.specs?.['menuCategory']) : '');
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : '');
  const initialDispatch = listing ? (listing.dispatch_time ?? '7d') : '5d';
  const [dispatch, setDispatch] = useState<string>(initialDispatch.startsWith('custom:') ? 'custom' : initialDispatch);
  const [customDispatch, setCustomDispatch] = useState(initialDispatch.startsWith('custom:') ? initialDispatch.slice(7) : '');
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
  const [eta, setEta] = useState(10);
  const [convertPct, setConvertPct] = useState<number | null>(null);
  const left = useCountdown(pending, eta);
  useEffect(() => () => { objectUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);

  const createPreview = (file: File) => { const url = URL.createObjectURL(file); objectUrls.current.add(url); return url; };
  const removePhoto = (id: string) => setPhotos(current => { const item = current.find(photo => photo.id === id); if (item?.file) { URL.revokeObjectURL(item.preview); objectUrls.current.delete(item.preview); } return current.filter(photo => photo.id !== id); });
  const [loadingVideo, setLoadingVideo] = useState(false);
  /** Opens the video editor. A video that is already saved (e.g. from bulk upload) is downloaded first so it can be trimmed/tagged like a new one. */
  const editVideo = async () => {
    if (!video) return;
    if (video.file) { setEditing(video.file); return; }
    if (!video.preview) { setError('기존 영상을 불러오지 못했어요. 영상을 다시 선택해 주세요.'); return; }
    setLoadingVideo(true); setError('');
    try {
      let blob: Blob | null = null;
      if (video.path) { const { data } = await supabase.storage.from('market-media').download(video.path); blob = data; }
      if (!blob) { const res = await fetch(video.preview); if (!res.ok) throw new Error('fetch'); blob = await res.blob(); }
      const ext = (video.path?.split('.').pop() ?? 'mp4').replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
      const type = blob.type.startsWith('video/') ? blob.type : ext.toLowerCase() === 'mov' ? 'video/quicktime' : 'video/mp4';
      setEditing(new File([blob], `video.${ext}`, { type }));
    } catch { setError('기존 영상을 불러오지 못했어요. 영상을 다시 선택해 주세요.'); }
    finally { setLoadingVideo(false); }
  };
  const removeVideo = () => { if (video?.file) { URL.revokeObjectURL(video.preview); objectUrls.current.delete(video.preview); } setVideo(null); };
  const movePhoto = (id: string, offset: number) => setPhotos(current => { const from = current.findIndex(photo => photo.id === id); const to = from + offset; if (from < 0 || to < 0 || to >= current.length) return current; const next = [...current]; const [item] = next.splice(from, 1); if (!item) return current; next.splice(to, 0, item); return next; });
  const dropPhoto = (targetId: string) => { if (!draggedPhoto || draggedPhoto === targetId) return; setPhotos(current => { const from = current.findIndex(photo => photo.id === draggedPhoto); const to = current.findIndex(photo => photo.id === targetId); if (from < 0 || to < 0) return current; const next = [...current]; const [item] = next.splice(from, 1); if (!item) return current; next.splice(to, 0, item); return next; }); setDraggedPhoto(null); };

  const selectMedia = async (selected: File[]) => {
    if (!selected.length) return;
    const selectedPhotos = selected.filter(isListingPhoto);
    const selectedVideos = selected.filter(isListingVideo);
    if (photos.length + selectedPhotos.length > MAX_LISTING_PHOTOS || Number(Boolean(video)) + selectedVideos.length > 1) { setError(`사진은 최대 ${MAX_LISTING_PHOTOS}장, 영상은 1개까지 선택할 수 있어요.`); return; }
    /* Show the previews immediately; the slower duration check runs in the background. */
    const quick = selected.filter(f => !isListingPhoto(f) && !isListingVideo(f)).length ? '사진은 JPG·PNG·WEBP, 영상은 MP4·MOV·WEBM 형식만 지원해요.' : selectedPhotos.some(photoTooLarge) ? '사진은 장당 최대 10MB까지 올릴 수 있어요.' : selectedVideos[0] && selectedVideos[0].size > MAX_VIDEO_BYTES ? '영상은 최대 100MB까지 올릴 수 있어요.' : '';
    if (quick) { setError(quick); return; }
    const newVideo = selectedVideos[0] ? { file: selectedVideos[0], preview: createPreview(selectedVideos[0]) } : null;
    const newPhotos = selectedPhotos.map(file => ({ id: crypto.randomUUID(), file, preview: createPreview(file) }));
    if (newVideo) { setVideo(newVideo); setEditing(newVideo.file); }
    if (newPhotos.length) setPhotos(current => [...current, ...newPhotos]);
    setError('');
    /* 길이(30초) 검사는 여기서 하지 않는다: 긴 영상은 편집기에서 잘라 쓰는 것이 정상 흐름이고, 길이는 저장할 때 확인한다. 여기서는 영상을 읽을 수 있는지만 본다. */
    if (newVideo) readVideoDuration(newVideo.file).catch(err => {
      setError(err instanceof Error ? err.message : '미디어를 확인해 주세요.');
      URL.revokeObjectURL(newVideo.preview); objectUrls.current.delete(newVideo.preview);
      setVideo(cur => (cur?.preview === newVideo.preview ? null : cur)); setEditing(cur => (cur === newVideo.file ? null : cur));
    });
  };

  const save = async (status: 'draft' | 'published') => {
    if (!title.trim()) { setError('상품명을 입력해 주세요.'); return; }
    if (!postCategoryLabels.includes(menuCategory)) { setError('메뉴 카테고리를 선택해 주세요.'); return; }
    const p = Number(price); if (!Number.isFinite(p) || p < 1) { setError('판매 가격(USD)을 입력해 주세요.'); return; }
    if (photos.length === 0 && !video) { setError('사진 또는 영상을 1개 이상 추가해 주세요.'); return; }
    if (video?.file) { try { await validateListingFiles([video.file]); } catch (err) { setError(err instanceof Error ? err.message : '영상을 확인해 주세요.'); return; } }
    if (sourceType === 'factory' && !factory) { setError('공장을 선택해 주세요.'); return; }
    if (sourceType === 'other' && !factory.trim()) { setError('출처 / 공장을 직접 입력해 주세요.'); return; }
    setError(''); setPending(true);
    const uploaded: string[] = [];
    try {
      let nextVideo = video?.path ?? null;
      let nextThumb: string | null | undefined = video?.file ? null : undefined;
      setEta(estimateUploadSeconds([...photos.flatMap(p => p.file ? [p.file] : []), ...(video?.file ? [video.file] : [])], 30, Boolean(video?.file && video.file.size > COMPRESS_THRESHOLD_BYTES)));
      if (video?.file) { setConvertPct(0); const ready = await compressVideoForWeb(video.file, r => setConvertPct(Math.round(r * 100))); setConvertPct(null); setEta(estimateUploadSeconds([ready, ...photos.flatMap(p => p.file ? [p.file] : [])])); const ext = ready.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4'; const path = `${folder}/${crypto.randomUUID()}.${ext}`; const { error: e } = await putMarketMedia(path, ready, { cacheControl: LONG_CACHE }); if (e) throw new Error('영상을 올리지 못했어요. 다시 시도해 주세요.'); uploaded.push(path); nextVideo = path; nextThumb = await uploadVideoThumbnail(ready, folder); if (nextThumb) uploaded.push(nextThumb); }
      const photoPaths: string[] = [];
      const settled = await Promise.allSettled(photos.map(async photo => {
        if (photo.path) return photo.path;
        if (!photo.file) return null;
        const file = await compressImage(photo.file);
        const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error: e } = await putMarketMedia(path, file, { cacheControl: LONG_CACHE });
        if (e) throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.');
        uploaded.push(path);
        return path;
      }));
      if (settled.some(r => r.status === 'rejected')) throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.');
      for (const r of settled) if (r.status === 'fulfilled' && r.value) photoPaths.push(r.value);
      // small picture for feed cards: keep the old one while the first photo is unchanged, otherwise make a new one
      const prevCard = cardPathOf(listing?.specs);
      const firstPhoto = photos[0];
      let card: string | null = null;
      if (firstPhoto?.path && firstPhoto.path === listing?.media_urls[0]) card = prevCard;
      else if (firstPhoto?.file) { card = await uploadCardImage(firstPhoto.file, folder); if (card) uploaded.push(card); }
      const cleanSpecs = cleanWatchSpecs(specs);
      cleanSpecs['sourceType'] = sourceType;
      cleanSpecs['menuCategory'] = menuCategory;
      if (card) cleanSpecs['cardImage'] = card;
      if (sourceType === 'custom') delete cleanSpecs['factory'];
      else cleanSpecs['factory'] = factory.trim().slice(0, 80);
      const row = { title: title.trim().slice(0, 100), description: description.trim().slice(0, 3000), category, price: Math.round(p), box_price: boxPriceOrDefault(boxPrice), dispatch_time: dispatchValue(dispatch, customDispatch), media_urls: photoPaths, video_url: nextVideo, ...(nextThumb !== undefined || !nextVideo ? { thumbnail_url: nextVideo ? nextThumb ?? null : null } : {}), video_tags: nextVideo ? videoTags : [], specs: cleanSpecs, source_lang: activeLang(), status, updated_at: new Date().toISOString() };
      if (listing) {
        const { error: e } = await supabase.from('posts').update(row).eq('id', listing.id); if (e) throw new Error('저장하지 못했어요.');
        const retained = new Set(photoPaths); const removed = [...(prevCard && prevCard !== card ? [prevCard] : []), ...listing.media_urls.filter(path => !retained.has(path)), ...(listing.video_url && listing.video_url !== nextVideo ? [listing.video_url] : [])]; if (removed.length) await (owner ? removeMarketMedia({ data: { paths: removed } }).catch(() => undefined) : supabase.storage.from('market-media').remove(removed));
      } else {
        if (owner && !owner.seller) throw new Error(PROXY_NOT_SELLER_MESSAGE);
        const nickname = owner?.nickname || (await supabase.from('profiles').select('nickname').eq('user_id', user.id).maybeSingle()).data?.nickname || 'vela member';
        const { error: e } = await supabase.from('posts').insert({ ...row, user_id: owner?.id ?? user.id, creator: nickname.slice(0, 40), image_key: 'uploaded' });
        if (e) throw new Error('저장하지 못했어요. 셀러 승인 상태를 확인해 주세요.');
      }
      releaseLeaveWarning();
      onSaved();
    } catch (err) { if (uploaded.length) await removeMarketFiles(uploaded); setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.'); }
    finally { setPending(false); setConvertPct(null); }
  };

  const photoPicker = useRef<HTMLInputElement>(null);
  const photoTotal = photos.length;
  const [touched, setTouched] = useState(false);
  /* 파일은 항상 상품 주인(대리 셀러면 그 셀러)의 폴더에 저장한다. 그래야 피드가 사진·영상을 정상적으로 불러온다. */
  const folder = owner?.id ?? user.id;
  const releaseLeaveWarning = useLeaveWarning(pending || touched || (!listing && (photos.length > 0 || video !== null || title.trim() !== '' || description.trim() !== '' || price !== '')));
  return <div className="form-panel mt-4 rounded-lg border border-border p-4" onChange={() => setTouched(true)}>
    {editing && <VideoEditor file={editing} catalog={catalog.filter(c => c.id !== listing?.id)} onCancel={() => setEditing(null)} onDone={({ file, tags }) => { if (video?.file) { URL.revokeObjectURL(video.preview); objectUrls.current.delete(video.preview); } setVideo({ file, preview: createPreview(file) }); setVideoTags(tags); setEditing(null); }} />}
    <div className="flex items-center justify-between"><h3 className="font-semibold"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{listing ? tx('상품 수정') : tx('새 상품 등록')}</span></h3><Button size="icon" variant="ghost" aria-label={tx("닫기")} onClick={onClose}><X /></Button></div>
    <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-destructive bg-muted p-4"><span className="flex gap-2 text-primary"><Video/><ImagePlus/></span><span className="text-sm text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("영상과 사진 한 번에 선택")}</span></span><span className="text-xs text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx('영상 1개 · 30초 · 100MB · 사진 10MB / 사진 {0}/{1}', { 0: photoTotal, 1: MAX_LISTING_PHOTOS })}</span></span>
      <input className="sr-only" type="file" accept="image/*,video/*" multiple aria-label={tx("상품 영상과 사진 한 번에 선택")} onChange={e => { const selected = Array.from(e.target.files || []); e.target.value = ''; void selectMedia(selected); }} /></label>
    {(video || photos.length > 0) && <div className="mt-3 space-y-3" aria-label={tx("선택한 상품 미디어")}>
      {video && <div className="grid grid-cols-2 gap-2"><div className="relative overflow-hidden rounded-md border border-primary bg-muted"><VideoStartPreview file={video.file} src={video.preview} className="aspect-square w-full object-cover"/><span className="absolute left-2 top-2 rounded bg-background/80 px-2 py-1 text-[11px] font-semibold text-primary"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("메인 피드 영상")}</span></span><Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 size-7" aria-label={tx("영상 제거")} onClick={removeVideo}><X /></Button><Button type="button" size="sm" variant="gold" className="absolute bottom-2 right-2" disabled={loadingVideo} onClick={() => void editVideo()}>{loadingVideo ? <RefreshCw className="animate-spin" /> : <Scissors />}<span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("영상 편집")}</span></Button>{videoTags.length > 0 && <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-[11px] text-primary"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("상품 태그 {0}개", { 0: videoTags.length })}</span></span>}</div>{photoTotal < MAX_LISTING_PHOTOS && <Button type="button" variant="outline" className="aspect-square h-auto w-full flex-col gap-2 border-2 border-dashed border-destructive bg-muted text-primary" aria-label={tx("사진 추가")} onClick={() => photoPicker.current?.click()}><ImagePlus className="size-7"/><span className="text-xs"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("사진 추가")}</span></span><span className="text-[11px] text-muted-foreground">{photoTotal}/{MAX_LISTING_PHOTOS}</span></Button>}</div>}
      {photos.length > 0 && <div><p className="mb-2 text-xs text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("상세 사진 갤러리 · 끌어서 또는 화살표로 순서 변경")}</span></p><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => <div key={photo.id} draggable onDragStart={() => setDraggedPhoto(photo.id)} onDragEnd={() => setDraggedPhoto(null)} onDragOver={event => event.preventDefault()} onDrop={() => dropPhoto(photo.id)} className={`relative overflow-hidden rounded-md border bg-muted ${draggedPhoto === photo.id ? 'border-primary opacity-60' : 'border-border'}`}>
          {photo.preview ? <img src={photo.preview} alt={tx("상세 사진 {0}", { 0: index + 1 })} className="aspect-square w-full object-cover"/> : <div className="grid aspect-square place-items-center text-xs text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("사진 {0}", { 0: index + 1 })}</span></div>}
          <span className="absolute left-1 top-1 grid size-6 place-items-center rounded bg-background/80 text-[10px] font-semibold">{index + 1}</span><GripVertical className="absolute bottom-1 left-1 size-5 rounded bg-background/80 p-0.5 text-muted-foreground" aria-hidden="true"/>
          <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 size-6" aria-label={tx("상세 사진 {0} 제거", { 0: index + 1 })} onClick={() => removePhoto(photo.id)}><X /></Button>
          <div className="absolute bottom-1 right-1 flex gap-1"><Button type="button" size="icon" variant="secondary" className="size-6" disabled={index === 0} aria-label={tx("상세 사진 {0} 앞으로 이동", { 0: index + 1 })} onClick={() => movePhoto(photo.id, -1)}><ArrowLeft /></Button><Button type="button" size="icon" variant="secondary" className="size-6" disabled={index === photos.length - 1} aria-label={tx("상세 사진 {0} 뒤로 이동", { 0: index + 1 })} onClick={() => movePhoto(photo.id, 1)}><ArrowRight /></Button></div>
        </div>)}
      </div></div>}
    </div>}
    <input ref={photoPicker} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label={tx("추가 사진 선택")} onChange={e => { const selected = Array.from(e.target.files || []); e.target.value = ''; void selectMedia(selected); }} />
    <PostCategoryField value={menuCategory} onChange={setMenuCategory} />
    <label htmlFor="l-title" className="form-label"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("상품명")}</span></label><input id="l-title" className="form-input" maxLength={100} value={title} onChange={e => setTitle(e.target.value)} />
    <label htmlFor="l-cat" className="form-label"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("카테고리")}</span></label><select id="l-cat" className="form-input" value={category} onChange={e => setCategory(e.target.value)}><option value="시계"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("시계")}</span></option><option value="악세사리"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("악세사리")}</span></option></select>
    <WatchSpecificationsForm idPrefix="l-spec" value={specs} onChange={setSpecs} afterWater={<SourceFactorySelect id="l-source" sourceType={sourceType} factory={factory} onChange={(type, next) => { setSourceType(type); setFactory(next); }} />} />
    <label htmlFor="l-desc" className="form-label"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("상품 설명")}</span></label><textarea id="l-desc" className="form-input min-h-24" maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} />
    <div className="grid grid-cols-2 gap-x-3">
      <div><label htmlFor="l-price" className="form-label"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("판매 가격 (USD $)")}</span></label><input id="l-price" className="form-input" type="number" min={1} inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} /></div>
      <fieldset className="sm:col-span-2"><legend className="form-label"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("예상 발송 시간")}</span></legend><DispatchSelect dispatch={dispatch} customDispatch={customDispatch} onDispatch={setDispatch} onCustom={setCustomDispatch} /></fieldset><div><label htmlFor="l-box" className="form-label"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("풀셋 박스 (USD $, 선택)")}</span></label><input id="l-box" className="form-input" type="number" min={0} inputMode="numeric" value={boxPrice} onChange={e => setBoxPrice(e.target.value)} /></div>
    </div>
    <p className="mt-2 text-xs text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("가격은 USD로 저장되며, 구매자에게는 각자의 통화로 자동 환산되어 표시돼요.")}</span><span data-i18n-skip data-no-translate translate="no" className="notranslate">{price && Number(price) > 0 ? tx(" (현재 표시: {0})", { 0: formatMoney(Number(price)) }) : ''}</span></p>
    <div className="mt-1">
      <div className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3" role="note">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-relaxed text-destructive"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("⚠️ [경고] 허위 공장 표기 또는 출처 정보 도용 적발 시, 예고 없이 상품 삭제 및 셀러 자격이 영구 박탈될 수 있으며 에스크로 정산이 동결 조치됩니다.")}</span></p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx('Listing false factory information will result in immediate seller ban and escrow freeze.')}</span></p>
        </div>
      </div>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive"><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx(error)}</span></p>}
    <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" disabled={pending} onClick={() => void save('draft')}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("임시 저장")}</span></Button><Button disabled={pending} onClick={() => void save('published')}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{pending ? (convertPct !== null ? `영상 최적화 중… ${convertPct}%` : left > 0 ? `저장 중… ${left}초` : '마무리 중…') : tx('게시하기')}</span></Button></div>
  </div>;
}
