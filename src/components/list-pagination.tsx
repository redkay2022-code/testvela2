import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { tx } from '@/lib/dom-translate';
import { Button } from './ui/button';

/** How many rows a seller can show on one page. */
export const PAGE_SIZES = [5, 10, 15, 20] as const;
const SIZE_KEY = 'vela.list-page-size';

/** Page numbers to show: 1 … 4 5 6 … 12 (first, last and the pages around the current one). */
export function pageNumbers(current: number, count: number): (number | 'gap-start' | 'gap-end')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | 'gap-start' | 'gap-end')[] = [1];
  const from = Math.max(2, Math.min(current - 1, count - 4)), to = Math.min(count - 1, Math.max(current + 1, 5));
  if (from > 2) out.push('gap-start');
  for (let n = from; n <= to; n++) out.push(n);
  if (to < count - 1) out.push('gap-end');
  out.push(count);
  return out;
}

/** Splits a list into pages. The chosen page size is remembered on this device; the page restarts at 1 when `resetKey` changes. */
export function usePagination<T>(items: readonly T[], resetKey = '') {
  const [size, setSizeState] = useState<number>(10);
  const [page, setPage] = useState(1);
  useEffect(() => { try { const saved = Number(localStorage.getItem(SIZE_KEY)); if ((PAGE_SIZES as readonly number[]).includes(saved)) setSizeState(saved); } catch { /* storage blocked */ } }, []);
  useEffect(() => setPage(1), [resetKey]);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pageCount);
  const setSize = (next: number) => { setSizeState(next); setPage(1); try { localStorage.setItem(SIZE_KEY, String(next)); } catch { /* storage blocked */ } };
  return { items: items.slice((current - 1) * size, current * size), page: current, size, total, pageCount, setPage, setSize };
}

type Pager = ReturnType<typeof usePagination>;

/** Numbered page buttons plus a "rows per page" drop-down. Hidden while everything fits on the smallest page. */
export function ListPagination({ pager, onChange }: { pager: Pick<Pager, 'page' | 'size' | 'total' | 'pageCount' | 'setPage' | 'setSize'>; onChange?: () => void }) {
  if (pager.total <= PAGE_SIZES[0]) return null;
  const go = (n: number) => { pager.setPage(Math.min(pager.pageCount, Math.max(1, n))); onChange?.(); };
  return <div className="mt-5 flex flex-wrap items-center justify-center gap-3" data-i18n-skip data-no-translate translate="no">
    <nav className="flex flex-wrap items-center gap-1" aria-label={tx('페이지 이동')}>
      <Button type="button" size="icon" variant="ghost" aria-label={tx('이전 페이지')} disabled={pager.page <= 1} onClick={() => go(pager.page - 1)}><ChevronLeft /></Button>
      {pageNumbers(pager.page, pager.pageCount).map(n => typeof n === 'number'
        ? <Button key={n} type="button" size="sm" variant={n === pager.page ? 'goldOutline' : 'ghost'} className="min-w-9 px-2" aria-label={tx('{0}페이지', { 0: n })} aria-current={n === pager.page ? 'page' : undefined} onClick={() => go(n)}>{n}</Button>
        : <span key={n} className="px-1 text-muted-foreground" aria-hidden="true">…</span>)}
      <Button type="button" size="icon" variant="ghost" aria-label={tx('다음 페이지')} disabled={pager.page >= pager.pageCount} onClick={() => go(pager.page + 1)}><ChevronRight /></Button>
    </nav>
    <select className="form-input h-9 w-auto min-w-28 px-3 text-sm" aria-label={tx('표시 개수')} value={pager.size} onChange={e => { pager.setSize(Number(e.target.value)); onChange?.(); }}>
      {PAGE_SIZES.map(n => <option key={n} value={n}>{tx('페이지당 {0}개', { 0: n })}</option>)}
    </select>
  </div>;
}
