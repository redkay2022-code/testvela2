export type InsuranceTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'black';
export const BASE_FEE_RATE = 0.1;
export const insuranceTiers = [
  { id: 'bronze', label: 'BRONZE', threshold: 0, rate: 0.1, discount: 0, perk: '기본 등급' },
  { id: 'silver', label: 'SILVER', threshold: 5_000_000, rate: 0.07, discount: 0.3, perk: '보험료 30% 할인' },
  { id: 'gold', label: 'GOLD', threshold: 15_000_000, rate: 0.05, discount: 0.5, perk: '월 2회 무료 국제배송' },
  { id: 'platinum', label: 'PLATINUM', threshold: 40_000_000, rate: 0.03, discount: 0.7, perk: '무제한 무료 국제배송' },
  { id: 'black', label: 'BLACK / VVIP', threshold: 100_000_000, rate: 0.01, discount: 0.9, perk: '우선 소싱 & Fast-Track QC' },
] as const satisfies readonly { id: InsuranceTier; label: string; threshold: number; rate: number; discount: number; perk: string }[];
export type InsuranceTierInfo = (typeof insuranceTiers)[number];
export function tierInfo(id: InsuranceTier): InsuranceTierInfo { return insuranceTiers.find(t => t.id === id) ?? insuranceTiers[0]; }
/** Tier from verified cumulative spend in won ("over" = strictly greater). */
export function tierForSpend(spend: number): InsuranceTierInfo {
  let current: InsuranceTierInfo = insuranceTiers[0];
  for (const t of insuranceTiers) if (t.threshold === 0 || spend > t.threshold) current = t;
  return current;
}
export function nextInsuranceTier(spend: number) {
  const idx = insuranceTiers.indexOf(tierForSpend(spend));
  const next = insuranceTiers[idx + 1];
  if (!next) return null;
  return { tier: next, remaining: Math.max(0, next.threshold - spend), progress: Math.min(100, (Math.max(0, spend) / next.threshold) * 100) };
}
export function insuranceFee(price: number, tier: InsuranceTier = 'bronze') {
  const base = Math.round(price * BASE_FEE_RATE);
  const final = Math.round(price * tierInfo(tier).rate);
  return { base, discount: base - final, final };
}
export const won = (n: number) => `₩${new Intl.NumberFormat('ko-KR').format(Math.round(n))}`;
