import { Button } from '@/components/ui/button';
import { flagOf } from '@/lib/seller-plans';

/** Admin-only (Korean): the seller application details as a readable table instead of one line of codes. */
const PLAN_NAMES: Record<string, string> = { basic: 'Basic (무료)', pro: 'Pro Seller (출시 1개월 무료)', enterprise: 'Enterprise Partner ($199/월)' };
const CATEGORY_NAMES: Record<string, string> = { watches: '시계', jewelry_accessories: '주얼리·액세서리', bags_leather: '가방·가죽제품', apparel: '의류', footwear: '신발', others: '기타' };
const CHANNEL_NAMES: Record<string, string> = { instagram: 'Instagram', website: '웹사이트', tiktok: 'TikTok', reddit: 'Reddit', physical_store: '오프라인 매장', others: '기타' };
const ROLE_NAMES: Record<string, string> = { creator_customizer: '제작자 / 커스터마이저', supplier_dealer: '공급업체 / 딜러', brand_owner: '브랜드 오너' };
const PRICE_NAMES: Record<string, string> = { under_500: '$500 미만', '500_2000': '$500 – $2,000', '2000_10000': '$2,000 – $10,000', above_10000: '$10,000 이상' };

const countryLabel = (code: string) => {
  let name = code;
  try { name = new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code; } catch { /* keep the code */ }
  return /^[A-Za-z]{2}$/.test(code) ? `${flagOf(code)} ${name} (${code.toUpperCase()})` : name;
};
const paymentLabel = (a: ApplicationDetails) => {
  if (!a.plan || a.plan === 'basic') return '—';
  if (a.payment_status === 'paid') return `결제 완료${a.paid_until ? ` · ~${new Date(a.paid_until).toLocaleDateString('ko-KR')}` : ''}`;
  if (a.payment_status === 'pending') return '결제 대기';
  if (a.promo_ends_at) { const t = Date.parse(a.promo_ends_at); if (Number.isFinite(t)) return `${t > Date.now() ? '무료 기간 중' : '무료 기간 종료 (선택 대기)'} · ~${new Date(t).toLocaleDateString('ko-KR')}`; }
  return '—';
};
const names = (list: string[] | null | undefined, map: Record<string, string>) => (list ?? []).map(x => map[x] ?? x).join(', ') || '—';

export type ApplicationDetails = {
  id: string; plan?: string | null; requested_plan?: string | null; country?: string | null; business_role?: string | null; avg_price_range?: string | null;
  billing_period?: string | null; payment_status?: string | null; promo_ends_at?: string | null; paid_until?: string | null;
  payment_txid?: string | null; payment_network?: string | null; payment_amount_usd?: number | null; payment_submitted_at?: string | null;
  main_categories?: string[] | null; sales_channels?: string[] | null; main_sales_items?: string | null; has_contracted_courier?: boolean | null;
};

export function ApplicationTable({ a, busy, onPlan, onConfirmPayment }: { a: ApplicationDetails; busy: boolean; onPlan: (id: string, approve: boolean) => void; onConfirmPayment: (id: string) => void }) {
  if (!a.plan && !a.country && !a.requested_plan) return null;
  const paying = a.payment_status === 'pending';
  const rows: [string, string][] = [
    ['국가 / 지역', a.country ? countryLabel(a.country) : '—'],
    ['요금제', a.plan ? PLAN_NAMES[a.plan] ?? a.plan : '—'],
    ['사업 형태', a.business_role ? ROLE_NAMES[a.business_role] ?? a.business_role : '—'],
    ['평균 가격대', a.avg_price_range ? PRICE_NAMES[a.avg_price_range] ?? a.avg_price_range : '—'],
    ['주요 카테고리', names(a.main_categories, CATEGORY_NAMES)],
    ['판매 채널', names(a.sales_channels, CHANNEL_NAMES)],
    ['주력 판매 품목', a.main_sales_items?.trim() || '—'],
    ['청구 주기', a.plan === 'basic' || !a.plan ? '—' : a.billing_period === 'yearly' ? '연간 (10% 할인)' : a.billing_period === 'monthly' ? '월간' : '—'],
    ['결제 / 무료 기간', paymentLabel(a)],
    ['택배사 계약', a.has_contracted_courier === null || a.has_contracted_courier === undefined ? '—' : a.has_contracted_courier ? '있음' : '없음'],
  ];
  const head = 'whitespace-nowrap border border-border bg-muted/40 px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const cell = 'border border-border px-3 py-2 align-top text-sm';
  return <div className="col-span-full mt-3 w-full" style={{ gridColumn: '1 / -1' }} data-i18n-skip data-no-translate translate="no">
    <dl className="app-detail-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="app-detail-table w-full overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead><tr>{rows.map(([label]) => <th key={label} scope="col" className={head}>{label}</th>)}</tr></thead>
        <tbody><tr>{rows.map(([label, value]) => <td key={label} className={cell + ' break-words'}>{value}</td>)}</tr></tbody>
      </table>
    </div>
    {paying && <div className="mt-2 grid gap-2 rounded-md border border-primary px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <strong className="text-primary">결제 확인 대기</strong>
        <span>{PLAN_NAMES[a.requested_plan ?? a.plan ?? 'basic'] ?? a.requested_plan ?? a.plan}{a.requested_plan ? ' (요금제 변경)' : ' (계속 이용)'}</span>
        <span>{a.billing_period === 'yearly' ? '연간' : '월간'} · {a.payment_amount_usd != null ? `$${a.payment_amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</span>
        <span>{a.payment_network ?? '—'}</span>
        {a.payment_submitted_at && <span className="text-muted-foreground">{new Date(a.payment_submitted_at).toLocaleString('ko-KR')}</span>}
      </div>
      <p className="break-all"><span className="text-muted-foreground">TXID </span>{a.payment_txid ? <code>{a.payment_txid}</code> : <span className="text-destructive">미제출 (TXID가 있어야 확인할 수 있어요)</span>}</p>
      <span className="inline-flex flex-wrap gap-2">
        <Button size="sm" variant="goldOutline" disabled={busy || !a.payment_txid} onClick={() => onConfirmPayment(a.id)}>결제 확인</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onPlan(a.id, false)}>결제 거절</Button>
      </span>
    </div>}
    {!paying && a.requested_plan && <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-primary px-3 py-2 text-sm">
      <strong className="text-primary">요금제 변경 요청</strong>
      <span>{PLAN_NAMES[a.plan ?? 'basic'] ?? a.plan} → {PLAN_NAMES[a.requested_plan] ?? a.requested_plan}</span>
      <span className="inline-flex flex-wrap gap-2">
        <Button size="sm" variant="goldOutline" disabled={busy} onClick={() => onPlan(a.id, true)}>변경 승인</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onPlan(a.id, false)}>변경 거절</Button>
      </span>
    </div>}
  </div>;
}

/** Admin-only: one dropdown with every applicant of the current filter; the detail table shows the chosen one. */
export function ApplicantPicker({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return <label className="mb-3 block" data-i18n-skip data-no-translate translate="no">
    <span className="mb-1 block text-xs text-muted-foreground">신청자 선택 ({options.length}명)</span>
    <select aria-label="신청자 선택" className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  </label>;
}
