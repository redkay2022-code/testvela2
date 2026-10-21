import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Pause, Play, Scissors, TriangleAlert, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { productCategories } from '@/lib/catalog';
import { DISPATCH_OPTIONS } from '@/lib/dispatch';
import { factoryOptions } from './source-factory';
import { postCategoryLabels } from '@/lib/feed-categories';
import { BULK_FIELDS, MAX_BULK, PASTE_ORDER, readTextFile, validateItem, type BulkField, type BulkItem } from '@/lib/bulk-upload';
import { bulkJob, idleState as idle, secondsOf, useBulkJob } from '@/lib/bulk-job';
import { MAX_LISTING_PHOTOS, MAX_VIDEO_SECONDS } from '@/lib/listing-media';
import { VideoEditor } from './video-editor';
import { useSessionState } from '@/lib/session-state';
import { isWatchStory, watchStoryOptions } from '@/lib/watch-story';
import { tx } from '@/lib/dom-translate';
import { t } from '@/lib/i18n';
import { useCurrency } from './currency';
const FIELD_LABEL: Record<BulkField, string> = { file: '파일명', title: '제목', price: '판매 가격', category: '카테고리', source: '제조/출처 구분', factory: '공장', dispatch: '예상 발송 시간', boxPrice: '풀셋 박스 추가 금액', brand: '브랜드', model: '모델명', material: '케이스 소재', movement: '무브먼트', caseSize: '케이스 직경', thickness: '두께', weight: '무게', glass: '글라스', waterResistance: '방수', additionalDetails: '추가 내용', description: '제품 소개', menuCategory: '메뉴 카테고리', sell: '마켓에 판매하기', storySubcategory: '세부 분류' };
const EDIT_FIELDS = BULK_FIELDS.filter(f => f !== 'file');

/**
 * Bulk upload: pick up to 20 videos (+ their photos), paste the product table from Excel / Sheets (or load a CSV),
 * then every video (or video-less photo set) is uploaded one by one as its OWN product. Same rules and the same posts table as the normal
 * single upload form, so the seller's login permissions apply. Two buttons: save as draft (hidden from buyers) or publish now.
 * Order shown to buyers: the video first, then the photos.
 * The job itself lives in lib/bulk-job.ts (outside React), so leaving the page and coming back shows the same list and progress;
 * it can be paused (finishes the current product), edited, then resumed.
 */
/** Small preview of a photo (cover image of a photo-only product). */
function CoverThumb({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return url ? <img src={url} alt="대표 이미지" className="size-10 shrink-0 rounded object-cover" /> : null;
}

/** Preview of one photo or video of a product (a small square). */
function Preview({ file, video }: { file: File; video?: boolean }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  if (!url) return <span className="block size-16 shrink-0 rounded bg-muted" />;
  return video ? <video src={url} className="size-16 shrink-0 rounded object-cover" muted playsInline preload="metadata" /> : <img src={url} alt="사진 미리보기" className="size-16 shrink-0 rounded object-cover" />;
}

/** Change the photos / video of one product by hand: remove, reorder (the first photo is the cover), add, replace the video. */
function MediaEditor({ item, disabled, seconds, onTrim }: { item: BulkItem; disabled: boolean; seconds: number | undefined; onTrim: () => void }) {
  const tooLong = !!item.video && !!seconds && seconds > MAX_VIDEO_SECONDS + 0.05, tooMany = item.photos.length > MAX_LISTING_PHOTOS;
  const btn = 'inline-flex size-7 items-center justify-center rounded border border-border bg-background disabled:opacity-40';
  return <div className="mt-3 rounded-md border border-border p-2 text-xs">
    <p className="mb-2 font-medium">사진 · 영상 수정 <span className="font-normal text-muted-foreground">(첫 번째 사진이 대표 이미지예요)</span></p>
    <div className="flex flex-wrap items-start gap-3">
      {item.video && <div className="grid gap-1"><Preview file={item.video} video /><span className={`text-center ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>영상{seconds ? ` ${Math.round(seconds)}초` : ''}</span><span className="flex gap-1"><button type="button" className={btn} aria-label="영상 길이 수정" disabled={disabled} onClick={onTrim}><Scissors className="size-4" /></button><button type="button" className={btn} aria-label="영상 빼기" disabled={disabled} onClick={() => bulkJob.setVideo(item.id, null)}><X className="size-4" /></button></span></div>}
      {item.photos.map((p, i) => <div key={`${p.name}-${p.size}-${i}`} className="grid gap-1">
        <Preview file={p} /><span className="text-center text-muted-foreground">{i === 0 ? '대표' : i + 1}</span>
        <span className="flex gap-1"><button type="button" className={btn} aria-label="앞으로" disabled={disabled || i === 0} onClick={() => bulkJob.movePhoto(item.id, i, -1)}><ChevronLeft className="size-4" /></button><button type="button" className={btn} aria-label="뒤로" disabled={disabled || i === item.photos.length - 1} onClick={() => bulkJob.movePhoto(item.id, i, 1)}><ChevronRight className="size-4" /></button><button type="button" className={btn} aria-label="사진 빼기" disabled={disabled} onClick={() => bulkJob.removePhoto(item.id, i)}><X className="size-4" /></button></span>
      </div>)}
      {!item.video && item.photos.length === 0 && <p className="text-destructive">사진도 영상도 없어요. 아래에서 추가하거나 이 상품을 빼 주세요.</p>}
    </div>
    {tooMany && <p className="mt-2 text-destructive" role="alert">수정 필요: 사진이 {item.photos.length}장이에요. 최대 {MAX_LISTING_PHOTOS}장까지 올릴 수 있어요. 사진을 빼 주세요.</p>}
    {tooLong && <p className="mt-2 text-destructive" role="alert">수정 필요: 영상이 {Math.ceil(seconds!)}초예요. 최대 1분까지 올릴 수 있어요. 가위 버튼(영상 길이 수정)으로 줄여 주세요.</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <label className="flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-3 py-2"><Upload size={14} />사진 추가<input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="사진 추가" disabled={disabled} onChange={e => { if (e.target.files?.length) bulkJob.addPhotos(item.id, Array.from(e.target.files)); e.target.value = ''; }} /></label>
      {item.video && <button type="button" className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 disabled:opacity-50" disabled={disabled} onClick={onTrim}><Scissors size={14} />영상 길이 수정</button>}
      <label className="flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-3 py-2"><Upload size={14} />{item.video ? '영상 바꾸기' : '영상 추가'}<input className="sr-only" type="file" accept="video/mp4,video/quicktime,.mov" aria-label="영상 선택" disabled={disabled} onChange={e => { const f = e.target.files?.[0]; if (f) bulkJob.setVideo(item.id, f); e.target.value = ''; }} /></label>
    </div>
  </div>;
}

export function BulkUpload({ user, existingTitles, onClose, onDone }: { user: User; existingTitles: string[]; onClose: () => void; onDone: () => void }) {
  useCurrency();
  const job = useBulkJob();
  const { items, states, notes, phase } = job;
  const [paste, setPaste] = useSessionState('bulk-upload:paste', '');
  const [open, setOpen] = useSessionState<string | null>('bulk-upload:open', null);
  const [mode, setMode] = useSessionState<'table' | 'manual'>('bulk-upload:mode', 'table');
  const [trimming, setTrimming] = useState<string | null>(null); // product whose video is open in the video editor
  const trimItem = items.find(i => i.id === trimming);
  const manual = mode === 'manual';
  const titles = useMemo(() => new Set(existingTitles.map(t => t.normalize('NFC').trim().toLowerCase())), [existingTitles]);
  const checks = useMemo(() => Object.fromEntries(items.map(it => [it.id, validateItem(it, titles, manual, secondsOf(it, job.durations))])), [items, titles, manual, job.durations]);
  useEffect(() => { bulkJob.setContext({ user, titles, onDone, relaxed: manual }); });

  const running = phase === 'running' || phase === 'pausing';
  const paused = phase === 'paused';
  const addFiles = (list: FileList | null) => { if (list?.length) bulkJob.addFiles(Array.from(list)); };
  const ready = items.filter(i => checks[i.id]?.plan && states[i.id]?.status !== 'done').length;
  const doneCount = items.filter(i => states[i.id]?.status === 'done').length;
  const blocked = items.filter(i => !checks[i.id]?.plan).length;
  const pending = items.length - doneCount;
  const overLimit = items.filter(i => states[i.id]?.status !== 'done' && (i.photos.length > MAX_LISTING_PHOTOS || (secondsOf(i, job.durations) ?? 0) > MAX_VIDEO_SECONDS + 0.05)).length;
  const close = () => { if (pending === 0) { bulkJob.reset(); setPaste(''); setOpen(null); } onClose(); };
  const clearAll = () => { if (pending > 0 && !window.confirm('선택한 파일과 입력한 내용을 모두 비울까요?')) return; bulkJob.reset(); setPaste(''); setOpen(null); };

  return <section className="seller-flow-card mt-4" aria-label="일괄 업로드">
    <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">{manual ? `사진 + 영상 일괄 업로드 · 내용 수기 입력 (영상 1개 또는 사진 묶음 1개 = 상품 1개, 최대 ${MAX_BULK}개)` : `일괄 업로드 (영상 1개 또는 사진 묶음 1개 = 상품 1개, 최대 ${MAX_BULK}개)`}</h3><Button variant="ghost" size="icon" aria-label="닫기" onClick={close} disabled={running}><X /></Button></div>
    <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="일괄 업로드 종류"><Button type="button" role="tab" aria-selected={!manual} size="sm" variant={!manual ? 'goldOutline' : 'ghost'} disabled={running} onClick={() => setMode('table')}>사진 + 영상</Button><Button type="button" role="tab" aria-selected={manual} size="sm" variant={manual ? 'goldOutline' : 'ghost'} disabled={running} onClick={() => setMode('manual')}>사진 + 영상만 (내용 수기 입력)</Button></div>
    {manual ? <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
      <li>영상과 사진을 한꺼번에 선택해요. 사진 이름은 “상품이름-1.jpg”, “상품이름-2.jpg”처럼 맞추면 같은 이름의 영상 상품에 묶이고, 영상이 없으면 사진만으로 된 상품이 돼요.</li>
      <li>내용(제목·가격 등)은 입력하지 않아요. 올린 뒤 “내 상품 관리”의 편집에서 입력하면 돼요. 상품을 누르면 사진·영상을 빼거나 순서를 바꾸고, 영상 길이를 줄이거나 추가할 수 있어요.</li>
      <li>줄마다 문제가 없는지 확인하고 “임시저장으로 올리기” 또는 “바로 공개하며 올리기”를 눌러요. 올리는 중 일시정지도 할 수 있어요.</li>
    </ol> : <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
      <li>영상과 사진을 한꺼번에 선택해요. 사진 이름은 “상품이름-1.jpg”, “상품이름-2.jpg”처럼 맞춰요. 같은 이름의 영상이 있으면 그 영상 상품에 묶이고, 영상이 없으면 사진만으로 된 상품이 돼요. 첫 번째 사진(-1)이 대표 이미지예요.</li>
      <li>엑셀/구글 시트의 표를 복사해 아래 칸에 붙여넣어요. 열 순서: {PASTE_ORDER.map(f => FIELD_LABEL[f]).join(' · ')} (첫 줄에 머리글을 넣으면 순서가 달라도 돼요)</li>
      <li>줄마다 문제가 없는지 확인하고 “업로드 시작”을 눌러요.</li>
      <li>올리는 중에 “일시정지”를 누르면 지금 올리는 상품까지 마친 뒤 멈춰요. 멈춘 동안 남은 상품을 고치고 “이어서 올리기”를 누르면 돼요. 다른 페이지에 갔다가 돌아와도 진행 상황이 그대로 보여요. 새로고침하거나 탭을 닫으면 선택한 파일이 사라져요.</li>
    </ol>}
    <div className="mt-3 flex min-h-20 flex-wrap items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted p-3 text-sm" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!running) addFiles(e.dataTransfer.files); }}>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2"><Upload size={18} />파일 선택 (여러 개)<input className="sr-only" type="file" multiple accept="video/mp4,video/quicktime,.mov,image/jpeg,image/png,image/webp" aria-label="영상과 사진 선택" disabled={running} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /></label>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2"><Upload size={18} />폴더 통째로 선택<input className="sr-only" type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} aria-label="폴더 선택" disabled={running} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /></label>
      <span className="w-full text-center text-xs text-muted-foreground">파일을 여기로 끌어다 놓아도 돼요</span>
    </div>
    {manual ? (items.length > 0 && <div className="mt-2 flex justify-end">{items.length > 0 && <button type="button" className="ml-auto text-xs text-muted-foreground underline disabled:opacity-50" disabled={running} onClick={clearAll}>목록 비우기</button>}</div>) : <>
    <textarea className="form-input mt-3 min-h-24 font-mono text-xs" placeholder="엑셀에서 복사한 표를 여기에 붙여넣기" value={paste} onChange={e => setPaste(e.target.value)} disabled={running} />
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="goldOutline" disabled={!paste.trim() || !items.length || running} onClick={() => { bulkJob.applyTable(paste); setPaste(''); }}>표 적용</Button>
      <label className="cursor-pointer text-xs underline">CSV 파일 불러오기<input className="sr-only" type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" disabled={!items.length || running} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) bulkJob.applyTable(await readTextFile(f)); }} /></label>
      {items.length > 0 && <button type="button" className="ml-auto text-xs text-muted-foreground underline disabled:opacity-50" disabled={running} onClick={clearAll}>목록 비우기</button>}
    </div>
    </>}
    {trimItem?.video && <VideoEditor file={trimItem.video} catalog={[]} onCancel={() => setTrimming(null)} onDone={({ file }) => { bulkJob.setVideo(trimItem.id, file); setTrimming(null); }} />}
    {notes.map(n => <p key={n} className="mt-2 text-xs text-muted-foreground" role="status">{n}</p>)}
    {items.length > 0 && <>
      {paused && <p className="mt-3 rounded-md border border-primary bg-primary/10 p-2 text-xs" role="status">일시정지됨 · 남은 상품을 고친 뒤 “이어서 올리기”를 눌러 주세요.</p>}
      {phase === 'pausing' && <p className="mt-3 rounded-md border border-border bg-muted p-2 text-xs" role="status">지금 올리는 상품까지 마치고 멈춰요…</p>}
      <ul className="mt-4 grid gap-2">{items.map((it, idx) => {
        const c = checks[it.id]!, s = states[it.id] ?? idle;
        return <li key={it.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id}>
              <span className="flex items-center gap-2">{!it.video && it.photos[0] && <CoverThumb file={it.photos[0]} />}<span className="block min-w-0 truncate font-medium">{idx + 1}. {it.values.title || (manual ? it.name.replace(/\.[^.]+$/, '') : '(제목 없음)')}</span></span>
              <span className="block truncate text-xs text-muted-foreground">{it.video ? it.video.name : `영상 없음 · ${it.name}`} · 사진 {it.photos.length}장 · {it.values.price ? `$${it.values.price}` : '가격 없음'}</span>
            </button>
            {s.status === 'done' ? <CheckCircle2 className="size-5 text-primary" aria-label="완료" /> : s.status === 'working' ? <span className="flex items-center gap-1 text-xs"><Loader2 className="size-4 animate-spin" />{s.step}{s.step === '영상 변환' ? ` ${s.pct}%` : ''}</span> : c.plan ? <span className="text-xs text-primary">준비됨</span> : <span className="flex items-center gap-1 text-xs text-destructive"><TriangleAlert className="size-4" />수정 필요</span>}
            {s.status !== 'working' && s.status !== 'done' && <Button variant="ghost" size="icon" aria-label="이 상품 빼기" disabled={running} onClick={() => bulkJob.remove(it.id)}><X className="size-4" /></Button>}
          </div>
          {[...c.errors, ...c.warnings.map(w => `주의: ${w}`)].map(m => <p key={m} className={`mt-1 text-xs ${m.startsWith('주의') ? 'text-muted-foreground' : 'text-destructive'}`}>{m}</p>)}
          {s.status === 'error' && <p className="mt-1 text-xs text-destructive" role="alert">{s.error}</p>}
          {open === it.id && s.status !== 'done' && <MediaEditor item={it} disabled={running} seconds={secondsOf(it, job.durations)} onTrim={() => setTrimming(it.id)} />}
          {open === it.id && s.status !== 'done' && !manual && <div className="mt-3 grid grid-cols-2 gap-2">{EDIT_FIELDS.map(f => f === 'description' || f === 'additionalDetails'
            ? <textarea key={f} className="form-input col-span-2" aria-label={FIELD_LABEL[f]} placeholder={FIELD_LABEL[f]} value={it.values[f]} onChange={e => bulkJob.edit(it.id, f, e.target.value)} disabled={running} />
            : f === 'category'
              ? <select key={f} className="form-input notranslate" translate="no" aria-label={FIELD_LABEL[f]} value={it.values[f]} onChange={e => bulkJob.edit(it.id, f, e.target.value)} disabled={running}><option value="">카테고리 (기본: 커스텀제작)</option>{productCategories.map(cat => <option key={cat} translate="no" className="notranslate">{tx(cat)}</option>)}</select>
              : f === 'menuCategory'
                ? <select key={f} className="form-input notranslate" translate="no" aria-label={FIELD_LABEL[f]} value={it.values[f]} onChange={e => bulkJob.edit(it.id, f, e.target.value)} disabled={running}><option value="">메뉴 카테고리 (비우면 시계)</option>{postCategoryLabels.map(cat => <option key={cat} value={cat} translate="no" data-i18n-skip className="notranslate">{isWatchStory(cat) ? t('story') : tx(cat)}</option>)}</select>
                : f === 'storySubcategory'
                  ? isWatchStory(it.values.menuCategory) ? <select key={f} className="form-input notranslate col-span-2" translate="no" data-i18n-skip required aria-required="true" aria-label={t('storySubcategory')} value={it.values[f]} onChange={e => bulkJob.edit(it.id, f, e.target.value)} disabled={running}><option value="" disabled translate="no" className="notranslate">{t('selectStorySubcategory')}</option>{watchStoryOptions.map(([,label,key])=><option key={label} value={label} translate="no" className="notranslate">{t(key)}</option>)}</select> : null
                : f === 'sell'
                  ? <select key={f} className="form-input" aria-label={FIELD_LABEL[f]} value={it.values[f]} onChange={e => bulkJob.edit(it.id, f, e.target.value)} disabled={running}><option value="">마켓에 판매하기 (비우면 예)</option><option>예</option><option>아니오</option></select>
                  : f === 'source'
                    ? <select key={f} className="form-input" aria-label={FIELD_LABEL[f]} value={it.values[f]} onChange={e => bulkJob.edit(it.id, f, e.target.value)} disabled={running}><option value="">제조 / 출처 구분 (비우면 커스텀 제작)</option><option>커스텀 제작</option><option>공장 선택</option><option>기타 - 직접입력</option></select>
                    : <input key={f} list={f === 'dispatch' ? 'bulk-dispatch-list' : f === 'factory' ? 'bulk-factory-list' : undefined} className="form-input" aria-label={FIELD_LABEL[f]} placeholder={FIELD_LABEL[f]} value={it.values[f]} onChange={e => bulkJob.edit(it.id, f, e.target.value)} disabled={running} />)}</div>}
        </li>;
      })}</ul>
      <datalist id="bulk-dispatch-list">{DISPATCH_OPTIONS.map(o => <option key={o.value} value={o.label} />)}</datalist><datalist id="bulk-factory-list">{factoryOptions.map(f => <option key={f} value={f} />)}</datalist>
      <p className="mt-4 text-xs text-muted-foreground">{manual ? '내용 없이 사진·영상만 올려요. 제목은 파일 이름으로, 가격은 없이 저장되니 올린 뒤 “내 상품 관리”의 편집에서 내용을 입력해 주세요. 임시저장은 구매자에게 보이지 않아요.' : '임시저장으로 올리면 구매자에게 보이지 않아요. “내 상품 관리”에서 확인한 뒤 상품마다 판매 스위치를 켜서 공개해요.'}</p>
      {overLimit > 0 && <p className="mt-3 rounded-md border border-destructive p-2 text-xs text-destructive" role="alert">{`수정 필요: 사진이 ${MAX_LISTING_PHOTOS}장을 넘거나 영상이 1분을 넘는 상품이 ${overLimit}개 있어요. 상품을 눌러 사진을 빼거나 영상 길이를 줄여 주세요.`}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {running
          ? <Button variant="goldOutline" onClick={() => bulkJob.pause()} disabled={phase === 'pausing'}><Pause className="mr-1 size-4" />{phase === 'pausing' ? '멈추는 중…' : '일시정지'}</Button>
          : <><Button onClick={() => bulkJob.start(false)} disabled={ready === 0}>{paused ? <Play className="mr-1 size-4" /> : null}{paused ? `이어서 올리기 · 임시저장 (${ready}개)` : `임시저장으로 올리기 (${ready}개)`}</Button><Button variant="goldOutline" onClick={() => bulkJob.start(true)} disabled={ready === 0}>{paused ? '이어서 올리기 · 바로 공개' : '바로 공개하며 올리기'}</Button></>}
        <span className="text-xs text-muted-foreground">완료 {doneCount} · 수정 필요 {blocked}{running ? ` · ${job.publish ? '바로 공개' : '임시저장'}로 올리는 중` : ''}</span>
      </div>
    </>}
  </section>;
}
