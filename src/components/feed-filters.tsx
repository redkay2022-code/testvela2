import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from './ui/button';
import { factoryOptions } from './source-factory';
import type { FeedFilter } from '@/lib/feed-filters';
import { hasFeedFilter } from '@/lib/feed-filters';

/** Inline home search + filters (seller, product, factory, USD price, Shorts only), stored in URL search state. */
export function FeedFilters({ value, count, onChange }: { value: FeedFilter; count: number; onChange: (next: FeedFilter) => void }) {
  const [text, setText] = useState(value.fq ?? '');
  const [open, setOpen] = useState(Boolean(value.ffactory || value.fmin != null || value.fmax != null || value.fshorts));
  useEffect(() => setText(value.fq ?? ''), [value.fq]);
  useEffect(() => { const t = setTimeout(() => { if ((value.fq ?? '') !== text.trim()) onChange({ ...value, fq: text.trim() || undefined }); }, 300); return () => clearTimeout(t); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (v: string) => { const n = Number(v); return v.trim() && Number.isFinite(n) && n >= 0 ? n : undefined; };
  const active = hasFeedFilter(value);
  return <section className="feed-filters" aria-label="피드 검색 및 필터">
    <div className="feed-filters-row">
      <label className="feed-filters-search"><Search size={16}/><input value={text} onChange={e => setText(e.target.value)} placeholder="판매자 · 제품명 · 공장 검색" aria-label="판매자, 제품명, 공장 검색"/>{text && <button type="button" aria-label="검색어 지우기" onClick={() => setText('')}><X size={14}/></button>}</label>
      <Button type="button" variant={open || active ? 'goldOutline' : 'ghost'} size="icon" aria-label="필터" aria-expanded={open} onClick={() => setOpen(o => !o)}><SlidersHorizontal size={16}/></Button>
    </div>
    {open && <div className="feed-filters-panel">
      <select className="form-input" aria-label="공장" value={value.ffactory ?? ''} onChange={e => onChange({ ...value, ffactory: e.target.value || undefined })}>
        <option value="">모든 공장</option><option value="커스텀 제작">커스텀 제작</option>{factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <div className="feed-filters-price"><input className="form-input" inputMode="numeric" placeholder="최소 USD" aria-label="최소 금액 USD" defaultValue={value.fmin ?? ''} onBlur={e => onChange({ ...value, fmin: num(e.target.value) })}/><span>–</span><input className="form-input" inputMode="numeric" placeholder="최대 USD" aria-label="최대 금액 USD" defaultValue={value.fmax ?? ''} onBlur={e => onChange({ ...value, fmax: num(e.target.value) })}/></div>
      <label className="feed-filters-check"><input type="checkbox" checked={Boolean(value.fshorts)} onChange={e => onChange({ ...value, fshorts: e.target.checked || undefined })}/>숏츠(영상)만 보기</label>
    </div>}
    {active && <div className="feed-filters-summary"><span>{count}개 게시물</span><button type="button" onClick={() => { setText(''); onChange({}); }}>필터 초기화</button></div>}
  </section>;
}
