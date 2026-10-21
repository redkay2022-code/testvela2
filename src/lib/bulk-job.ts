import { useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { uploadCardImage } from '@/lib/card-image';
import { compressImage, LONG_CACHE } from '@/lib/image-compress';
import { uploadListingVideo } from '@/lib/video-upload';
import { uploadVideoThumbnail } from '@/lib/video-thumbnail';
import { readVideoDuration, MAX_VIDEO_SECONDS } from '@/lib/listing-media';
import { isWatchStory, isWatchStoryTag } from '@/lib/watch-story';
import { activeLang } from '@/lib/i18n';
import { isListingPhoto, isListingVideo } from '@/lib/listing-media';
import { applyRows, groupFiles, MAX_BULK, parseTable, validateItem, type BulkField, type BulkItem } from '@/lib/bulk-upload';

/**
 * 일괄 업로드 작업을 화면(컴포넌트) 밖에서 들고 있는 저장소.
 * - 다른 페이지로 갔다가 돌아와도 목록·진행 상황이 그대로 보이고, 올리는 작업도 계속 이어진다.
 * - 일시정지: 지금 올리는 상품까지 마친 뒤 멈추고, 그동안 남은 상품을 고칠 수 있다.
 * 새로고침·탭 닫기·로그아웃을 하면 선택한 파일이 사라지므로 비워진다.
 */
export type ItemState = { status: 'idle' | 'working' | 'done' | 'error'; pct: number; step: string; error: string };
export type Phase = 'idle' | 'running' | 'pausing' | 'paused';
/** durations: seconds of each picked video, keyed by videoKey(file); filled in the background after a video is picked. */
export type JobSnapshot = { items: BulkItem[]; states: Record<string, ItemState>; notes: string[]; phase: Phase; publish: boolean; durations: Record<string, number> };
/** relaxed = photo + video only upload: title / price may stay empty (filled in later from the edit screen). */
type Context = { user: User; titles: Set<string>; onDone: () => void; relaxed?: boolean };

export const idleState: ItemState = { status: 'idle', pct: 0, step: '', error: '' };
const emptySnapshot = (): JobSnapshot => ({ items: [], states: {}, notes: [], phase: 'idle', publish: false, durations: {} });

let snap: JobSnapshot = emptySnapshot();
let picked: File[] = [];
let ctx: Context | null = null;
let pauseRequested = false;
let seq = 0;
const listeners = new Set<() => void>();

const emit = (patch: Partial<JobSnapshot>) => { snap = { ...snap, ...patch }; syncGuard(); listeners.forEach(l => l()); };
const setItemState = (id: string, patch: Partial<ItemState>) => emit({ states: { ...snap.states, [id]: { ...(snap.states[id] ?? idleState), ...patch } } });
const isDone = (id: string) => snap.states[id]?.status === 'done';
function editMedia(id: string, change: (item: BulkItem) => BulkItem) {
  if (snap.phase === 'running' || snap.phase === 'pausing' || isDone(id)) return;
  const old = snap.items.find(i => i.id === id); if (!old) return;
  const next = { ...change(old), custom: true };
  const before = [old.video, ...old.photos].filter((f): f is File => !!f), after = [next.video, ...next.photos].filter((f): f is File => !!f);
  // picked 는 '선택한 파일 전체' 목록이라, 이 상품에서 빠진 파일은 목록에서도 뺀다(다른 상품과 묶이지 않게).
  picked = [...picked.filter(f => !before.includes(f) || after.includes(f)), ...after.filter(f => !picked.includes(f))];
  emit({ items: snap.items.map(i => i.id === id ? next : i) });
  readDurations();
}
const fileKey = (f: File) => `${f.webkitRelativePath || f.name}|${f.size}|${f.lastModified}`;
export const videoKey = fileKey;
/** Seconds of a video once it has been read (undefined = not known yet). */
export const secondsOf = (item: BulkItem, durations: Record<string, number> = snap.durations): number | undefined => (item.video ? durations[fileKey(item.video)] : undefined);
const reading = new Set<string>();
/** Reads the length of every picked video once, in the background, so the list can warn about videos over 30 seconds. */
function readDurations() {
  for (const it of snap.items) {
    const v = it.video; if (!v) continue;
    const key = fileKey(v); if (key in snap.durations || reading.has(key)) continue;
    reading.add(key);
    void readVideoDuration(v).catch(() => 0).then(seconds => { reading.delete(key); if (typeof window !== 'undefined') emit({ durations: { ...snap.durations, [key]: seconds } }); });
  }
}

/** 올리는 중이거나 아직 못 올린 상품이 남아 있으면, 새로고침·탭 닫기 때 경고한다. */
const onUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
let guarded = false;
function syncGuard() {
  if (typeof window === 'undefined') return;
  const need = snap.phase === 'running' || snap.phase === 'pausing' || snap.items.some(i => !isDone(i.id));
  if (need && !guarded) { window.addEventListener('beforeunload', onUnload); guarded = true; }
  else if (!need && guarded) { window.removeEventListener('beforeunload', onUnload); guarded = false; }
}

export const bulkJob = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => snap,
  /** 화면이 열릴 때마다 최신 로그인 정보·기존 제목·완료 후 새로고침 함수를 넘겨 둔다. */
  setContext(next: Context) { ctx = next; },

  addFiles(list: File[]) {
    const okFile = (f: File) => /\.(mp4|mov|jpe?g|png|webp)$/i.test(f.name) && !f.name.startsWith('.');
    const seen = new Set(picked.map(fileKey));
    const fresh = list.filter(okFile).filter(f => { const k = fileKey(f); if (seen.has(k)) return false; seen.add(k); return true; });
    if (!fresh.length) return;
    picked = [...picked, ...fresh];
    // 이미 올라간 상품은 그대로 두고, 나머지 파일만 다시 묶는다. 이미 정한 순서와 입력한 내용은 유지한다.
    const doneItems = snap.items.filter(i => isDone(i.id));
    const doneFiles = new Set(snap.items.filter(i => isDone(i.id) || i.custom).flatMap(i => [i.video, ...i.photos]).filter((f): f is File => !!f));
    const g = groupFiles(picked.filter(f => !doneFiles.has(f)));
    const sig = (it: BulkItem) => `${it.name}|${it.video?.size ?? 'photos'}`;
    const grouped = new Map(g.items.map(n => [sig(n), n]));
    const used = new Set<string>();
    const merged: BulkItem[] = [];
    for (const it of snap.items) {
      if (isDone(it.id) || it.custom) { merged.push(it); continue; }
      const n = grouped.get(sig(it)); if (!n) continue;
      used.add(sig(it)); merged.push({ ...n, id: it.id, values: it.values });
    }
    for (const n of g.items) if (!used.has(sig(n))) merged.push({ ...n, id: `b${++seq}-${n.id}` });
    const room = Math.max(0, MAX_BULK - doneItems.length);
    const overflow = merged.filter(i => !isDone(i.id)).length - room;
    let items = merged;
    if (overflow > 0) { let drop = overflow; items = [...merged].reverse().filter(i => { if (drop > 0 && !isDone(i.id)) { drop--; return false; } return true; }).reverse(); }
    const msg: string[] = [];
    const extra = g.extraVideos.length + g.extraPhotoProducts.length + Math.max(0, overflow);
    if (extra) msg.push(`상품은 영상·사진 묶음을 합쳐 ${MAX_BULK}개까지만 올릴 수 있어요. ${extra}개는 제외했어요.`);
    emit({ items, notes: msg });
    readDurations();
  },
  applyTable(text: string) {
    const rows = parseTable(text);
    if (!rows.length) { emit({ notes: ['표에서 읽을 수 있는 줄이 없어요. 엑셀에서 머리글 줄까지 함께 복사했는지 확인해 주세요.'] }); return; }
    const r = applyRows(snap.items, rows);
    emit({ items: r.items, notes: r.unmatched.length ? [`파일명을 찾지 못한 줄: ${r.unmatched.join(', ')} (영상 이름 또는 사진 상품 이름을 확인해 주세요)`] : [`${rows.length}줄을 적용했어요.`] });
  },
  edit(id: string, field: BulkField, value: string) {
    if (snap.phase === 'running' || snap.phase === 'pausing') return;
    emit({ items: snap.items.map(it => it.id === id ? { ...it, values: { ...it.values, [field]: value, ...(field === 'storySubcategory' && isWatchStory(it.values.menuCategory) && isWatchStoryTag(value) ? { title: value } : {}) } } : it) });
  },
  remove(id: string) {
    if (snap.phase === 'running' || snap.phase === 'pausing' || isDone(id)) return;
    const it = snap.items.find(i => i.id === id); if (!it) return;
    picked = picked.filter(f => f !== it.video && !it.photos.includes(f));
    const states = Object.fromEntries(Object.entries(snap.states).filter(([key]) => key !== id));
    emit({ items: snap.items.filter(i => i.id !== id), states });
  },
  /** 상품 하나의 사진·영상을 직접 고친다(빼기·순서 바꾸기·추가·영상 바꾸기). 고친 상품은 파일 이름으로 다시 묶이지 않는다. */
  removePhoto(id: string, index: number) { editMedia(id, it => ({ ...it, photos: it.photos.filter((_, i) => i !== index) })); },
  movePhoto(id: string, index: number, delta: -1 | 1) { editMedia(id, it => { const to = index + delta; if (to < 0 || to >= it.photos.length) return it; const photos = [...it.photos]; [photos[index], photos[to]] = [photos[to]!, photos[index]!]; return { ...it, photos }; }); },
  addPhotos(id: string, list: File[]) { const add = list.filter(isListingPhoto); if (add.length) editMedia(id, it => ({ ...it, photos: [...it.photos, ...add.filter(f => !it.photos.some(p => fileKey(p) === fileKey(f)))] })); },
  setVideo(id: string, file: File | null) { if (file && !isListingVideo(file)) return; editMedia(id, it => ({ ...it, video: file })); },
  start(publish: boolean) { if (snap.phase === 'running' || snap.phase === 'pausing') return; emit({ publish }); void run(); },
  pause() { if (snap.phase !== 'running') return; pauseRequested = true; emit({ phase: 'pausing' }); },
  reset() { if (snap.phase === 'running' || snap.phase === 'pausing') return; picked = []; pauseRequested = false; snap = emptySnapshot(); syncGuard(); listeners.forEach(l => l()); },
  /** 로그아웃 등으로 강제로 비울 때. */
  forceReset() { pauseRequested = true; picked = []; ctx = null; snap = emptySnapshot(); syncGuard(); listeners.forEach(l => l()); },
};

export const useBulkJob = () => useSyncExternalStore(bulkJob.subscribe, bulkJob.getSnapshot, bulkJob.getSnapshot);

async function run() {
  if (!ctx) return;
  pauseRequested = false;
  emit({ phase: 'running' });
  const attempted = new Set<string>();
  const nextItem = () => snap.items.find(i => !attempted.has(i.id) && !isDone(i.id) && ctx && validateItem(i, ctx.titles, ctx.relaxed, secondsOf(i)).plan);
  try {
    // 상품을 하나씩 순서대로 올린다: 휴대폰 메모리를 아끼고, 한 상품이 실패해도 나머지는 계속된다.
    for (;;) {
      if (pauseRequested) break;
      const it = nextItem(); if (!it) break;
      attempted.add(it.id);
      await uploadOne(it, snap.publish);
    }
  } finally {
    const remaining = pauseRequested && !!nextItem();
    pauseRequested = false;
    emit({ phase: remaining ? 'paused' : 'idle' });
    ctx?.onDone();
  }
}

async function uploadOne(item: BulkItem, publish: boolean) {
  const c = ctx; if (!c) return;
  const plan = validateItem(item, c.titles, c.relaxed, secondsOf(item)).plan; if (!plan) return;
  const userId = c.user.id;
  const uploaded: string[] = [];
  try {
    setItemState(item.id, { status: 'working', pct: 0, step: item.video ? '영상 확인' : '사진 확인', error: '' });
    // 영상 상품: 길이를 확인하고 변환한다. 사진만 있는 상품은 영상 단계를 모두 건너뛴다.
    let video: File | null = null;
    let videoUrl: string | null = null;
    if (item.video) {
      const seconds = await readVideoDuration(item.video).catch(() => 0);
      if (!seconds || seconds > MAX_VIDEO_SECONDS + 0.05) throw new Error('영상 길이는 최대 1분까지 가능해요.');
      setItemState(item.id, { step: '영상 업로드' });
      const up = await uploadListingVideo(item.video, userId, r => setItemState(item.id, { pct: Math.round(r * 100) }));
      if (up.storagePath) uploaded.push(up.storagePath);
      video = up.file; videoUrl = up.videoUrl;
    }
    setItemState(item.id, { pct: 100, step: '업로드' });
    const put = async (file: File) => {
      const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('market-media').upload(path, file, { cacheControl: LONG_CACHE });
      if (error) throw new Error('파일을 올리지 못했어요. 다시 시도해 주세요.');
      uploaded.push(path); return path;
    };
    const videoPath = videoUrl;
    // 사진은 번호 순서(-1, -2 … -10)를 지킨다. 사진만 있는 상품은 첫 사진이 대표 이미지다.
    const photoPaths: string[] = [];
    for (const photo of item.photos) photoPaths.push(await put(await compressImage(photo)));
    const card = item.photos[0] ? await uploadCardImage(item.photos[0], userId) : null; // 피드 카드용 작은 사진
    if (card) uploaded.push(card);
    let thumb: string | null = null;
    if (video) { thumb = await uploadVideoThumbnail(video, userId); if (thumb) uploaded.push(thumb); }
    else thumb = photoPaths[0] ?? null;
    const nickname = (await supabase.from('profiles').select('nickname').eq('user_id', userId).maybeSingle()).data?.nickname || 'vela member';
    const { error } = await supabase.from('posts').insert({ user_id: userId, creator: String(nickname).slice(0, 40), image_key: 'uploaded', source_lang: activeLang(), title: plan.title, description: plan.description, category: plan.category, price: plan.price, box_price: plan.boxPrice, dispatch_time: plan.dispatch, media_urls: photoPaths, video_url: videoPath, thumbnail_url: thumb, video_tags: [], specs: card ? { ...plan.specs, cardImage: card } : plan.specs, status: publish ? 'published' : 'draft' });
    if (error) throw new Error('저장하지 못했어요. 셀러 승인 상태를 확인해 주세요.');
    setItemState(item.id, { status: 'done', pct: 100, step: '완료' });
  } catch (err) {
    if (uploaded.length) await supabase.storage.from('market-media').remove(uploaded);
    setItemState(item.id, { status: 'error', step: '', error: err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.' });
  }
}
