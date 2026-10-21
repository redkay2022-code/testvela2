import { Button } from '@/components/ui/button';
import { flagOf } from '@/lib/seller-plans';

/** Admin-only (Korean): the seller application details as a readable table instead of one line of codes. */
const PLAN_NAMES: Record<string, string> = { basic: 'Basic (무료)', pro: 'Pro Seller (출시 3개월 무료)', enterprise: 'Enterprise Partner ($199/월)' };
const CATEGORY_NAMES: Record<string, string> = { watches: '시계', jewelry_accessories: '주얼리·액세서리', bags_leather: '가방·가죽제품', apparel: '의류', footwear: '신발', others: '기타' };
const CHANNEL_NAMES: Record<string, string> = { instagram: 'Instagram', website: '웹사이트', tiktok: 'TikTok', reddit: 'Reddit', physical_store: '오프라인 매장', others: '기타' };
const ROLE_NAMES: Record<string, string> = { creator_customizer: '제작자 / 커스터마이저', supplier_dealer: '공급업체 / 딜러', brand_owner: '브랜드 오너' };
const PRICE_NAMES: Record<string, string> = { under_500: '$500 미만', '500_2000': '$500 – $2,000', '2000_10000': '$2,000 – $10,000', above_10000: '$10,000 이상' };

const countryLabel = (code: string) => {
  let name = code;
  try { name = new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code; } catch { /* keep the code */ }
  return /^[A-Za-z]{2}$/.test(code) ? `${flagOf(code)} ${name} (${code.toUpperCase()})` : name;
};
const names = (list: string[] | null | undefined, map: Record<string, string>) => (list ?? []).map(x => map[x] ?? x).join(', ') || '—';

export type ApplicationDetails = {
  id: string; plan?: string | null; requested_plan?: string | null; country?: string | null; business_role?: string | null; avg_price_range?: string | null;
  main_categories?: string[] | null; sales_channels?: string[] | null; main_sales_items?: string | null; has_contracted_courier?: boolean | null;
};

export function ApplicationTable({ a, busy, onPlan }: { a: ApplicationDetails; busy: boolean; onPlan: (id: string, approve: boolean) => void }) {
  if (!a.plan && !a.country && !a.requested_plan) return null;
  const rows: [string, string][] = [
    ['국가 / 지역', a.country ? countryLabel(a.country) : '—'],
    ['요금제', a.plan ? PLAN_NAMES[a.plan] ?? a.plan : '—'],
    ['사업 형태', a.business_role ? ROLE_NAMES[a.business_role] ?? a.business_role : '—'],
    ['평균 가격대', a.avg_price_range ? PRICE_NAMES[a.avg_price_range] ?? a.avg_price_range : '—'],
    ['주요 카테고리', names(a.main_categories, CATEGORY_NAMES)],
    ['판매 채널', names(a.sales_channels, CHANNEL_NAMES)],
    ['주력 판매 품목', a.main_sales_items?.trim() || '—'],
    ['택배사 계약', a.has_contracted_courier === null || a.has_contracted_courier === undefined ? '—' : a.has_contracted_courier ? '있음' : '없음'],
  ];
  return <div className="col-span-full mt-2 w-full" style={{ gridColumn: '1 / -1' }} data-i18n-skip data-no-translate translate="no">
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map(([label, value]) => <tr key={label}>
          <th scope="row" className="w-28 border border-border bg-muted/40 px-3 py-2 text-left align-top font-medium text-muted-foreground sm:w-40">{label}</th>
          <td className="border border-border px-3 py-2 align-top break-words">{value}</td>
        </tr>)}
        {a.requested_plan && <tr>
          <th scope="row" className="w-28 border border-primary bg-muted/40 px-3 py-2 text-left align-top font-medium text-primary sm:w-40">요금제 변경 요청</th>
          <td className="border border-primary px-3 py-2 align-top">
            <span className="mr-3 font-medium">{PLAN_NAMES[a.plan ?? 'basic'] ?? a.plan} → {PLAN_NAMES[a.requested_plan] ?? a.requested_plan}</span>
            <span className="inline-flex flex-wrap gap-2">
              <Button size="sm" variant="goldOutline" disabled={busy} onClick={() => onPlan(a.id, true)}>변경 승인</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onPlan(a.id, false)}>변경 거절</Button>
            </span>
          </td>
        </tr>}
      </tbody>
    </table>
  </div>;
}
