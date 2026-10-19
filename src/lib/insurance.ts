export type InsuranceTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export const BASE_FEE_RATE = 0.1;
export const insuranceTiers = [
  { id: 'bronze', label: 'BRONZE', threshold: 0, rate: 0.1, discount: 0, perk: '기본 등급' },
  { id: 'silver', label: 'SILVER', threshold: 2_500, rate: 0.07, discount: 0.3, perk: '보험료 30% 할인' },
  { id: 'gold', label: 'GOLD', threshold: 6_000, rate: 0.05, discount: 0.5, perk: '보험료 50% 할인' },
  { id: 'platinum', label: 'PLATINUM', threshold: 12_000, rate: 0.03, discount: 0.7, perk: '보험료 70% 할인' },
] as const satisfies readonly { id: InsuranceTier; label: string; threshold: number; rate: number; discount: number; perk: string }[];
export type InsuranceTierInfo = (typeof insuranceTiers)[number];
export function tierInfo(id: InsuranceTier): InsuranceTierInfo { return insuranceTiers.find(t => t.id === id) ?? insuranceTiers[0]; }
/** Tier from verified cumulative crypto order value in USD ("over" = strictly greater). */
export function tierForSpend(spend: number): InsuranceTierInfo {
  let current: InsuranceTierInfo = insuranceTiers[0];
  for (const t of insuranceTiers) if (t.threshold === 0 || spend > t.threshold) current = t;
  return current;
}
export function nextInsuranceTier(spend: number) {
  const cur = tierForSpend(spend), idx = insuranceTiers.indexOf(cur);
  const next = insuranceTiers[idx + 1];
  if (!next) return null;
  return { tier: next, remaining: Math.max(0, next.threshold - spend), progress: Math.min(100, Math.max(0, (spend - cur.threshold) / (next.threshold - cur.threshold)) * 100) };
}
export function insuranceFee(price: number, tier: InsuranceTier = 'bronze') {
  const base = Math.round(price * BASE_FEE_RATE);
  const final = Math.round(price * tierInfo(tier).rate);
  return { base, discount: base - final, final };
}
export const won = (n: number) => `₩${new Intl.NumberFormat('ko-KR').format(Math.round(n))}`;

/** 보험료 요율: 포인트 멤버십 등급(최근 12개월 구매액 기준)과 같은 등급표를 씁니다. false로 바꾸면 모두 기본 10%. */
export const APPLY_TIER_INSURANCE_RATE = true;
export function insuranceRateForTier(tier: string | null | undefined, rates?: Record<string, number>): number {
  if (!APPLY_TIER_INSURANCE_RATE || !tier) return BASE_FEE_RATE;
  const r = rates?.[tier] ?? insuranceTiers.find(t => t.id === tier)?.rate;
  return typeof r === 'number' && r >= 0 && r <= BASE_FEE_RATE ? r : BASE_FEE_RATE;
}

/** Purchase insurance is based only on the seller item price (before any point discount), never the box. */
export function insuredPurchase(price: number, box = 0, insured = true, rate: number = BASE_FEE_RATE) {
  const insurance = insured ? Math.round(price * rate * 100) / 100 : 0;
  return { insurance, total: Math.round((price + box + insurance) * 100) / 100 };
}
