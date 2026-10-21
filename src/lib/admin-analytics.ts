/** 관리자 통계 화면에서 쓰는 날짜 계산·표시·CSV 도구. */
export const SEOUL_OFFSET_MS = 9 * 3600_000;
export const todayKst = () => new Date(Date.now() + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const usd = (n: number | null | undefined) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n ?? 0));
export const num = (n: number | null | undefined) => new Intl.NumberFormat('en-US').format(Number(n ?? 0));
export const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(1)}%` : '-');
export function delta(cur: number, prev: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (!prev && !cur) return { text: '변동 없음', tone: 'flat' };
  if (!prev) return { text: '신규', tone: 'up' };
  const d = ((cur - prev) / prev) * 100;
  return { text: `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%`, tone: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' };
}
export const STAGE_LABEL: Record<string, string> = { placed: '주문 접수', preparing: '준비 중', qc: 'QC 진행', qc_requested: 'QC 추가 요청', qc_done: 'QC 완료', shipping_prep: '배송 준비', shipped: '배송 중', delivered: '배송 완료', cancelled: '취소' };
export const ESCROW_LABEL: Record<string, string> = { PENDING: '입금 대기', HELD: '에스크로 보관', RELEASED: '정산 완료', REFUNDED: '환불', REJECTED: '거절' };
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n');
}
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
