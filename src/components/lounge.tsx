import { useRef, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Film, Loader2, Plus, Trash2, UserRound, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { Tx } from './tx';
import { SellerBadge } from './reputation';
import { useMarketPreview } from './market-preview';
import { usePostTranslation, TranslationToggle } from './post-translation';
import { supabase } from '@/integrations/supabase/client';
import { getSellerAvatar } from '@/lib/market.functions';
import { sellerIdentity } from '@/lib/seller-directory';
import { type LuxuryPost } from '@/lib/luxury-market';
import { isListingVideo, readVideoDuration } from '@/lib/listing-media';
import { faststartMp4 } from '@/lib/mp4-faststart';
import { putMarketMedia, removeMarketFiles } from '@/lib/market-upload';
import { uploadVideoThumbnail } from '@/lib/video-thumbnail';
import { validatePostTitle } from '@/lib/post-title';
import { LONG_CACHE } from '@/lib/image-compress';
import { activeLang } from '@/lib/i18n';
import { tx } from '@/lib/dom-translate';
import { useLeaveWarning } from '@/lib/leave-warning';
import { LOUNGE_CATEGORY, LOUNGE_MAX_BYTES, loungeTooLong } from '@/lib/lounge';

type Props = { posts: LuxuryPost[]; user: User | null; isSeller: boolean; requestAuth: () => void; notify: (text: string) => void; role?: 'buyer' | 'seller' | 'admin' | undefined };

export function LoungeFeed({ posts, user, isSeller, requestAuth, notify, role }: Props) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  return <section className="mt-4 grid gap-5" aria-label={tx('라운지')}>
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="text-lg font-semibold"><Tx>라운지</Tx></h1><p className="mt-1 text-xs text-muted-foreground"><Tx>셀러가 올리는 영상 이야기</Tx></p></div>
      {user && isSeller && <Button variant="gold" size="sm" onClick={() => setOpen(true)}><Film size={15} className="mr-1"/><Tx>라운지 영상 올리기</Tx></Button>}
    </div>
    {open && user && <LoungeUpload user={user} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void client.invalidateQueries({ queryKey: ['posts'] }); notify(tx('라운지에 올렸습니다.')); }}/>}
    {posts.length === 0 && <div className="lux-empty"><Film/><h2><Tx>라운지 영상이 아직 없습니다.</Tx></h2><p><Tx>셀러가 영상을 올리면 이곳에 표시됩니다.</Tx></p></div>}
    {posts.map(post => <LoungeCard key={post.id} post={post} user={user} requestAuth={requestAuth} notify={notify} role={role}/>)}
  </section>;
}

function LoungeCard({ post, user, requestAuth, notify, role }: { post: LuxuryPost; user: User | null; requestAuth: () => void; notify: (text: string) => void; role?: 'buyer' | 'seller' | 'admin' | undefined }) {
  const preview = useMarketPreview(), client = useQueryClient();
  const identity = sellerIdentity(post), following = preview.isFollowing(identity);
  const tr = usePostTranslation(post.source, !post.sample, false);
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false);
  const avatar = useQuery({ queryKey: ['seller-header-avatar', post.source.store_id ?? post.source.user_id ?? null], enabled: Boolean(post.source.store_id || post.source.user_id), queryFn: () => getSellerAvatar({ data: { storeId: post.source.store_id ?? undefined, userId: post.source.user_id ?? undefined } }), staleTime: 300_000 });
  const mine = Boolean(user && post.source.user_id === user.id);
  const remove = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const { data: raw } = await supabase.from('posts').select('video_url,thumbnail_url').eq('id', post.id).eq('user_id', user.id).maybeSingle();
      const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('user_id', user.id);
      if (error) { notify(tx('삭제하지 못했어요. 다시 시도해 주세요.')); return; }
      await removeMarketFiles([raw?.video_url, raw?.thumbnail_url].filter((p): p is string => typeof p === 'string' && p.length > 0 && !p.startsWith('http')));
      void client.invalidateQueries({ queryKey: ['posts'] });
    } finally { setBusy(false); setConfirming(false); }
  };
  return <article className="overflow-hidden rounded-xl border border-border bg-card" aria-label={post.title}>
    <header className="flex flex-wrap items-center gap-3 p-3" data-no-translate translate="no">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">{avatar.data?.avatar ? <img src={avatar.data.avatar} alt={`${post.creator} 프로필 사진`} className="size-full object-cover"/> : <UserRound size={20} className="text-muted-foreground"/>}</span>
      <div className="min-w-0 flex-1"><strong className="notranslate block truncate text-sm" data-i18n-skip translate="no">{post.creator}</strong><SellerBadge reputation={post.reputation} withRating/></div>
      <Button variant="goldOutline" size="sm" aria-pressed={following} onClick={() => { if (!user) { requestAuth(); return; } preview.toggleSeller(identity); }}>{following ? <Check size={13}/> : <Plus size={13}/>} <Tx>{following ? '팔로잉' : '팔로우'}</Tx></Button>
      <Button asChild variant="gold" size="sm"><Link to="/store" search={{ role, seller: identity, storeTab: 'products' }} className="notranslate" translate="no"><Tx>셀러 스토어 들어가기</Tx></Link></Button>
    </header>
    {post.video && <video className="aspect-video max-h-[75vh] w-full bg-black" data-lounge src={post.video} poster={post.images[0]} controls playsInline preload="none" onPlay={e => { document.querySelectorAll<HTMLVideoElement>('video[data-lounge]').forEach(v => { if (v !== e.currentTarget) v.pause(); }); }}/>}
    <div className="p-4">
      <h2 className="notranslate break-words text-base font-semibold" translate="no" data-i18n-skip>{post.sample ? post.title : tr.title}</h2>
      <p className="notranslate mt-2 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground" translate="no" data-i18n-skip>{post.sample ? post.description : tr.description}</p>
      <TranslationToggle t={tr}/>
      {mine && <div className="mt-3 flex justify-end gap-2">{confirming ? <><Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}><Tx>취소</Tx></Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void remove()}>{busy ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>} <Tx>정말 삭제</Tx></Button></> : <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}><Trash2 size={14}/> <Tx>삭제</Tx></Button>}</div>}
    </div>
  </article>;
}

function LoungeUpload({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [error, setError] = useState(''), [pending, setPending] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const release = useLeaveWarning(pending || file !== null || title.trim() !== '' || body.trim() !== '');
  const choose = async (selected: File | undefined) => {
    if (!selected) return;
    setError('');
    if (!isListingVideo(selected)) { setError(tx('MP4, MOV, WEBM 영상만 올릴 수 있어요.')); return; }
    if (selected.size > LOUNGE_MAX_BYTES) { setError(tx('영상이 300MB를 넘어요. 용량을 줄여 주세요.')); return; }
    try { if (loungeTooLong(await readVideoDuration(selected))) { setError(tx('라운지 영상은 5분 이내만 올릴 수 있어요.')); return; } }
    catch (e) { setError(e instanceof Error ? e.message : tx('영상 정보를 읽을 수 없어요.')); return; }
    if (url) URL.revokeObjectURL(url);
    setFile(selected); setUrl(URL.createObjectURL(selected));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!file) { setError(tx('영상을 선택해 주세요.')); return; }
    const titleError = validatePostTitle(title);
    if (titleError) { setError(titleError); return; }
    if (body.trim().length < 2) { setError(tx('내용을 입력해 주세요.')); return; }
    setError(''); setPending(true);
    const uploaded: string[] = [];
    try {
      const ready = await faststartMp4(file).catch(() => file);
      const ext = ready.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await putMarketMedia(path, ready, { cacheControl: LONG_CACHE });
      if (upError) throw new Error(tx('영상을 올리지 못했어요. 다시 시도해 주세요.'));
      uploaded.push(path);
      const thumb = await uploadVideoThumbnail(ready, user.id);
      if (thumb) uploaded.push(thumb);
      const nickname = String((await supabase.from('profiles').select('nickname').eq('user_id', user.id).maybeSingle()).data?.nickname || 'vela member').slice(0, 40);
      const { error: saveError } = await supabase.from('posts').insert({ user_id: user.id, title: title.trim(), description: body.trim(), category: LOUNGE_CATEGORY, source_lang: activeLang(), creator: nickname, image_key: 'uploaded', media_urls: [], video_url: path, thumbnail_url: thumb, price: null, box_price: null, dispatch_time: null, specs: { lounge: true }, video_tags: [] });
      if (saveError) throw new Error(tx('게시물을 저장하지 못했어요. 다시 시도해 주세요.'));
      release();
      onDone();
    } catch (err) {
      if (uploaded.length) await removeMarketFiles(uploaded);
      setError(err instanceof Error ? err.message : tx('잠시 후 다시 시도해 주세요.'));
    } finally { setPending(false); }
  };
  return <Dialog.Root open onOpenChange={open => { if (!open && !pending) onClose(); }}><Dialog.Portal><Dialog.Overlay className="lux-backdrop overlay-front"/><Dialog.Content aria-describedby={undefined} className="vela-category-sheet notranslate" translate="no">
    <div className="vela-category-sheet-header"><Dialog.Title><Tx>라운지 영상 올리기</Tx></Dialog.Title><Button variant="ghost" size="icon" aria-label="Close" disabled={pending} onClick={onClose}><X/></Button></div>
    <form className="mt-4 grid gap-4" onSubmit={e => void submit(e)}>
      <div><span className="mb-2 block text-xs font-semibold text-muted-foreground"><Tx>영상</Tx></span>
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted p-4 text-center"><Film size={26} className="text-primary"/><span className="text-sm text-muted-foreground"><Tx>영상 선택</Tx></span><span className="text-[11px] text-muted-foreground"><Tx>MP4·MOV·WEBM · 5분 이내 · 300MB 이하</Tx></span><input ref={pick} className="sr-only" type="file" accept="video/mp4,video/quicktime,video/webm,.mov" aria-label={tx('영상 선택')} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void choose(f); }}/></label>
        {url && <video className="mt-3 aspect-video w-full rounded-lg bg-black" src={url} controls playsInline preload="metadata"/>}
      </div>
      <label className="grid gap-2 text-xs font-semibold text-muted-foreground"><Tx>제목</Tx><input className="form-input text-foreground" maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder={tx('제목')}/></label>
      <label className="grid gap-2 text-xs font-semibold text-muted-foreground"><Tx>내용</Tx><textarea className="form-input min-h-28 text-foreground" maxLength={3000} value={body} onChange={e => setBody(e.target.value)} placeholder={tx('내용')}/></label>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="submit" variant="gold" disabled={pending}>{pending ? <><Loader2 size={15} className="mr-1 animate-spin"/><Tx>올리는 중…</Tx></> : <Tx>올리기</Tx>}</Button>
    </form>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
