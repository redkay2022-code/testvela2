import { useEffect, useMemo, useRef, useState } from 'react';
import { uploadCardImage } from '@/lib/card-image';
import type { User } from '@supabase/supabase-js';
import { CheckCircle2, Loader2, TriangleAlert, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { compressImage, LONG_CACHE } from '@/lib/image-compress';
import { compressVideoForWeb } from '@/lib/video-compress';
import { uploadVideoThumbnail } from '@/lib/video-thumbnail';
import { readVideoDuration, MAX_VIDEO_SECONDS } from '@/lib/listing-media';
import { productCategories } from '@/lib/catalog';
import { DISPATCH_OPTIONS } from '@/lib/dispatch';
import { factoryOptions } from './source-factory';
import { postCategoryLabels } from '@/lib/feed-categories';
import { activeLang } from '@/lib/i18n';
import { applyRows, BULK_FIELDS, groupFiles, MAX_BULK, PASTE_ORDER, parseTable, readTextFile, validateItem, type BulkField, type BulkItem } from '@/lib/bulk-upload';

type State = { status: 'idle' | 'working' | 'done' | 'error'; pct: number; step: string; error: string };
const idle: State = { status: 'idle', pct: 0, step: '', error: '' };
const FIELD_LABEL: Record<BulkField, string> = { file: '파일명', title: '제목', price: '판매 가격', category: '카테고리', source: '제조/출처 구분', factory: '공장', dispatch: '예상 발송 시간', boxPrice: '풀셋 박스 추가 금액', brand: '브랜드', model: '모델명', material: '케이스 소재', movement: '무브먼트', caseSize: '케이스 직경', thickness: '두께', weight: '무게', powerReserve: '파워리저브', glass: '글라스', waterResistance: '방수', additionalDetails: '추가 내용', description: '제품 소개', menuCategory: '메뉴 카테고리', sell: '마켓에 판매하기' };
const EDIT_FIELDS = BULK_FIELDS.filter(f => f !== 'file');

/**
 * Bulk upload: pick up to 20 videos (+ their photos), paste the product table from Excel / Sheets (or load a CSV),
 * then every video (or video-less photo set) is uploaded one by one as its OWN product. Same rules and the same posts table as the normal
 * single upload form, so the seller's login permissions apply. Two buttons: save as draft (hidden from buyers) or publish now.
 * Order shown to buyers: the video first, then the photos.
 */
/** Small preview of a photo (cover image of a photo-only product). */
function CoverThumb({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return url ? <img src={url} alt="대표 이미지" className="size-10 shrink-0 rounded object-cover" /> : null;
}

export function BulkUpload({ user, existingTitles, onClose, onDone }: { user: User; existingTitles: string[]; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState<BulkItem[]>([]);
  const [states, setStates] = useState<Record<string, State>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [paste, setPaste] = useState('');
    const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const picked = useRef<File[]>([]);
  const titles = useMemo(() => new Set(existingTitles.map(t => t.normalize('NFC').trim().toLowerCase())), [existingTitles]);
  const checks = useMemo(() => Object.fromEntries(items.map(it => [it.id, validateItem(it, titles)])), [items, titles]);
  const set = (id: string, patch: Partial<State>) => setStates(s => ({ ...s, [id]: { ...(s[id] ?? idle), ...patch } }));

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const okFile = (f: File) => /\.(mp4|mov|jpe?g|png|webp)$/i.test(f.name) && !f.name.startsWith('.');
    picked.current = [...picked.current, ...Array.from(list).filter(okFile)];
    const g = groupFiles(picked.current);
    // keep what the seller already typed for videos that are still selected
    const sig = (it: BulkItem) => `${it.name}|${it.video?.size ?? 'photos'}`;
    setItems(prev => g.items.map(n => { const old = prev.find(p => sig(p) === sig(n)); return old ? { ...n, values: old.values } : n; }));
    const msg: string[] = [];
    if (g.extraVideos.length) msg.push(`상품은 영상·사진 묶음을 합쳐 ${MAX_BULK}개까지만 올릴 수 있어요. 영상 ${g.extraVideos.length}개는 제외했어요.`);
    if (g.extraPhotoProducts.length) msg.push(`상품은 영상·사진 묶음을 합쳐 ${MAX_BULK}개까지만 올릴 수 있어요. 사진 상품 ${g.extraPhotoProducts.length}개(${g.extraPhotoProducts.slice(0, 3).join(', ')}…)는 제외했어요.`);
    setNotes(msg);
  };
  const applyTable = (text: string) => {
    const rows = parseTable(text);
    if (!rows.length) { setNotes(['표에서 읽을 수 있는 줄이 없어요. 엑셀에서 머리글 줄까지 함께 복사했는지 확인해 주세요.']); return; }
    setItems(cur => { const r = applyRows(cur, rows); setNotes(r.unmatched.length ? [`파일명을 찾지 못한 줄: ${r.unmatched.join(', ')} (영상 이름 또는 사진 상품 이름을 확인해 주세요)`] : [`${rows.length}줄을 적용했어요.`]); return r.items; });
  };
  const edit = (id: string, f: BulkField, value: string) => setItems(cur => cur.map(it => it.id === id ? { ...it, values: { ...it.values, [f]: value } } : it));
  const remove = (id: string) => { const it = items.find(i => i.id === id); if (it) picked.current = picked.current.filter(f => f !== it.video && !it.photos.includes(f)); setItems(cur => cur.filter(i => i.id !== id)); };

  const uploadOne = async (item: BulkItem, publish: boolean) => {
    const plan = checks[item.id]?.plan; if (!plan) return;
    const uploaded: string[] = [];
    try {
      set(item.id, { status: 'working', pct: 0, step: item.video ? '영상 확인' : '사진 확인', error: '' });
      // video products: check the length and convert; photo-only products skip every video step
      let video: File | null = null;
      if (item.video) {
        const seconds = await readVideoDuration(item.video).catch(() => 0);
        if (!seconds || seconds > MAX_VIDEO_SECONDS + 0.05) throw new Error(`영상 길이는 최대 ${MAX_VIDEO_SECONDS}초까지 가능해요.`);
        set(item.id, { step: '영상 변환' });
        video = await compressVideoForWeb(item.video, r => set(item.id, { pct: Math.round(r * 100) }));
      }
      set(item.id, { pct: 100, step: '업로드' });
      const put = async (file: File) => {
        const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('market-media').upload(path, file, { cacheControl: LONG_CACHE });
        if (error) throw new Error('파일을 올리지 못했어요. 다시 시도해 주세요.');
        uploaded.push(path); return path;
      };
      const videoPath = video ? await put(video) : null;
      // photos keep their number order (-1, -2 … -10); the first photo is the cover of a photo-only product
      const photoPaths: string[] = [];
      for (const photo of item.photos) photoPaths.push(await put(await compressImage(photo)));
      const card = item.photos[0] ? await uploadCardImage(item.photos[0], user.id) : null; // small picture for feed cards
      if (card) uploaded.push(card);
      let thumb: string | null = null;
      if (video) { thumb = await uploadVideoThumbnail(video, user.id); if (thumb) uploaded.push(thumb); }
      else thumb = photoPaths[0] ?? null;
      const nickname = (await supabase.from('profiles').select('nickname').eq('user_id', user.id).maybeSingle()).data?.nickname || 'vela member';
      const { error } = await supabase.from('posts').insert({ user_id: user.id, creator: String(nickname).slice(0, 40), image_key: 'uploaded', source_lang: activeLang(), title: plan.title, description: plan.description, category: plan.category, price: plan.price, box_price: plan.boxPrice, dispatch_time: plan.dispatch, media_urls: photoPaths, video_url: videoPath, thumbnail_url: thumb, video_tags: [], specs: card ? { ...plan.specs, cardImage: card } : plan.specs, status: publish ? 'published' : 'draft' });
      if (error) throw new Error('저장하지 못했어요. 셀러 승인 상태를 확인해 주세요.');
      set(item.id, { status: 'done', pct: 100, step: '완료' });
    } catch (err) {
      if (uploaded.length) await supabase.storage.from('market-media').remove(uploaded);
      set(item.id, { status: 'error', step: '', error: err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.' });
    }
  };
  const start = async (publish: boolean) => {
    setRunning(true);
    // one product after another: keeps phone memory low, and a failure never blocks the others
    for (const it of items) { if (states[it.id]?.status === 'done' || !checks[it.id]?.plan) continue; await uploadOne(it, publish); }
    setRunning(false); onDone();
  };

  const ready = items.filter(i => checks[i.id]?.plan && states[i.id]?.status !== 'done').length;
  const doneCount = items.filter(i => states[i.id]?.status === 'done').length;
  const blocked = items.filter(i => !checks[i.id]?.plan).length;

  return <section className="seller-flow-card mt-4" aria-label="일괄 업로드">
    <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">일괄 업로드 (영상 1개 또는 사진 묶음 1개 = 상품 1개, 최대 {MAX_BULK}개)</h3><Button variant="ghost" size="icon" aria-label="닫기" onClick={onClose} disabled={running}><X /></Button></div>
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
      <li>영상과 사진을 한꺼번에 선택해요. 사진 이름은 “상품이름-1.jpg”, “상품이름-2.jpg”처럼 맞춰요. 같은 이름의 영상이 있으면 그 영상 상품에 묶이고, 영상이 없으면 사진만으로 된 상품이 돼요. 첫 번째 사진(-1)이 대표 이미지예요.</li>
      <li>엑셀/구글 시트의 표를 복사해 아래 칸에 붙여넣어요. 열 순서: {PASTE_ORDER.map(f => FIELD_LABEL[f]).join(' · ')} (첫 줄에 머리글을 넣으면 순서가 달라도 돼요)</li>
      <li>줄마다 문제가 없는지 확인하고 “업로드 시작”을 눌러요. 올리는 동안 화면을 켜 두세요.</li>
    </ol>
    <div className="mt-3 flex min-h-20 flex-wrap items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted p-3 text-sm" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!running) addFiles(e.dataTransfer.files); }}>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2"><Upload size={18} />파일 선택 (여러 개)<input className="sr-only" type="file" multiple accept="video/mp4,video/quicktime,.mov,image/jpeg,image/png,image/webp" aria-label="영상과 사진 선택" disabled={running} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /></label>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2"><Upload size={18} />폴더 통째로 선택<input className="sr-only" type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} aria-label="폴더 선택" disabled={running} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /></label>
      <span className="w-full text-center text-xs text-muted-foreground">파일을 여기로 끌어다 놓아도 돼요</span>
    </div>
    <textarea className="form-input mt-3 min-h-24 font-mono text-xs" placeholder="엑셀에서 복사한 표를 여기에 붙여넣기" value={paste} onChange={e => setPaste(e.target.value)} disabled={running} />
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="goldOutline" disabled={!paste.trim() || !items.length || running} onClick={() => { applyTable(paste); setPaste(''); }}>표 적용</Button>
      <label className="cursor-pointer text-xs underline">CSV 파일 불러오기<input className="sr-only" type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" disabled={!items.length || running} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) applyTable(await readTextFile(f)); }} /></label>
    </div>
    {notes.map(n => <p key={n} className="mt-2 text-xs text-muted-foreground" role="status">{n}</p>)}
    {items.length > 0 && <>
      <ul className="mt-4 grid gap-2">{items.map((it, idx) => {
        const c = checks[it.id]!, s = states[it.id] ?? idle;
        return <li key={it.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id}>
              <span className="flex items-center gap-2">{!it.video && it.photos[0] && <CoverThumb file={it.photos[0]} />}<span className="block min-w-0 truncate font-medium">{idx + 1}. {it.values.title || '(제목 없음)'}</span></span>
              <span className="block truncate text-xs text-muted-foreground">{it.video ? it.video.name : `영상 없음 · ${it.name}`} · 사진 {it.photos.length}장 · {it.values.price ? `$${it.values.price}` : '가격 없음'}</span>
            </button>
            {s.status === 'done' ? <CheckCircle2 className="size-5 text-primary" aria-label="완료" /> : s.status === 'working' ? <span className="flex items-center gap-1 text-xs"><Loader2 className="size-4 animate-spin" />{s.step}{s.step === '영상 변환' ? ` ${s.pct}%` : ''}</span> : c.plan ? <span className="text-xs text-primary">준비됨</span> : <span className="flex items-center gap-1 text-xs text-destructive"><TriangleAlert className="size-4" />수정 필요</span>}
            {s.status !== 'working' && s.status !== 'done' && <Button variant="ghost" size="icon" aria-label="이 상품 빼기" disabled={running} onClick={() => remove(it.id)}><X className="size-4" /></Button>}
          </div>
          {[...c.errors, ...c.warnings.map(w => `주의: ${w}`)].map(m => <p key={m} className={`mt-1 text-xs ${m.startsWith('주의') ? 'text-muted-foreground' : 'text-destructive'}`}>{m}</p>)}
          {s.status === 'error' && <p className="mt-1 text-xs text-destructive" role="alert">{s.error}</p>}
          {open === it.id && s.status !== 'done' && <div className="mt-3 grid grid-cols-2 gap-2">{EDIT_FIELDS.map(f => f === 'description' || f === 'additionalDetails'
            ? <textarea key={f} className="form-input col-span-2" aria-label={FIELD_LABEL[f]} placeholder={FIELD_LABEL[f]} value={it.values[f]} onChange={e => edit(it.id, f, e.target.value)} disabled={running} />
            : f === 'category'
              ? <select key={f} className="form-input" aria-label={FIELD_LABEL[f]} value={it.values[f]} onChange={e => edit(it.id, f, e.target.value)} disabled={running}><option value="">카테고리 (기본: 커스텀제작)</option>{productCategories.map(cat => <option key={cat}>{cat}</option>)}</select>
              : f === 'menuCategory'
                ? <select key={f} className="form-input notranslate" translate="no" aria-label={FIELD_LABEL[f]} value={it.values[f]} onChange={e => edit(it.id, f, e.target.value)} disabled={running}><option value="">메뉴 카테고리 (비우면 시계)</option>{postCategoryLabels.map(cat => <option key={cat} translate="no" className="notranslate">{cat}</option>)}</select>
                : f === 'sell'
                  ? <select key={f} className="form-input" aria-label={FIELD_LABEL[f]} value={it.values[f]} onChange={e => edit(it.id, f, e.target.value)} disabled={running}><option value="">마켓에 판매하기 (비우면 예)</option><option>예</option><option>아니오</option></select>
                  : f === 'source'
                    ? <select key={f} className="form-input" aria-label={FIELD_LABEL[f]} value={it.values[f]} onChange={e => edit(it.id, f, e.target.value)} disabled={running}><option value="">제조 / 출처 구분 (비우면 커스텀 제작)</option><option>커스텀 제작</option><option>공장 선택</option><option>기타 - 직접입력</option></select>
                    : <input key={f} list={f === 'dispatch' ? 'bulk-dispatch-list' : f === 'factory' ? 'bulk-factory-list' : undefined} className="form-input" aria-label={FIELD_LABEL[f]} placeholder={FIELD_LABEL[f]} value={it.values[f]} onChange={e => edit(it.id, f, e.target.value)} disabled={running} />)}</div>}
        </li>;
      })}</ul>
      <datalist id="bulk-dispatch-list">{DISPATCH_OPTIONS.map(o => <option key={o.value} value={o.label} />)}</datalist><datalist id="bulk-factory-list">{factoryOptions.map(f => <option key={f} value={f} />)}</datalist>
      <p className="mt-4 text-xs text-muted-foreground">임시저장으로 올리면 구매자에게 보이지 않아요. “내 상품 관리”에서 확인한 뒤 상품마다 판매 스위치를 켜서 공개해요.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3"><Button onClick={() => void start(false)} disabled={running || ready === 0}>{running ? '올리는 중…' : `임시저장으로 올리기 (${ready}개)`}</Button><Button variant="goldOutline" onClick={() => void start(true)} disabled={running || ready === 0}>바로 공개하며 올리기</Button><span className="text-xs text-muted-foreground">완료 {doneCount} · 수정 필요 {blocked}</span></div>
    </>}
  </section>;
}
