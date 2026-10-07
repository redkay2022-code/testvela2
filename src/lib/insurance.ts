export type InsuranceTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export const BASE_FEE_RATE = 0.1;
export const insuranceTiers = [
  { id: 'bronze', label: 'BRONZE', threshold: 0, rate: 0.1, discount: 0, perk: '기본 등급' },
  { id: 'silver', label: 'SILVER', threshold: 2_500, rate: 0.07, discount: 0.3, perk: '보험료 30% 할인' },
  { id: 'gold', label: 'GOLD', threshold: 6_000, rate: 0.05, discount: 0.5, perk: '월 2회 무료 국제배송' },
  { id: 'platinum', label: 'PLATINUM', threshold: 12_000, rate: 0.03, discount: 0.7, perk: '무제한 무료 국제배송' },
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
  const idx = insuranceTiers.indexOf(tierForSpend(spend));
  const next = insuranceTiers[idx + 1];
  if (!next) return null;
  return { tier: next, remaining: Math.max(0, next.threshold - spend), progress: Math.min(100, Math.max(0, (spend - insuranceTiers[idx].threshold) / (next.threshold - insuranceTiers[idx].threshold)) * 100) };
}
export function insuranceFee(price: number, tier: InsuranceTier = 'bronze') {
  const base = Math.round(price * BASE_FEE_RATE);
  const final = Math.round(price * tierInfo(tier).rate);
  return { base, discount: base - final, final };
}
export const won = (n: number) => `₩${new Intl.NumberFormat('ko-KR').format(Math.round(n))}`;

/** Mandatory delivery insurance is based only on the seller product price. */
export function insuredPurchase(price: number, box = 0) {
  const insurance = Math.round(price * BASE_FEE_RATE * 100) / 100;
  return { insurance, total: Math.round((price + box + insurance) * 100) / 100 };
}
