/** 판매자 보험 옵션: 보험료 = 기본 상품가의 10% (풀셋 박스 금액 제외). USD, 센트 단위 반올림. */
export const INSURANCE_RATE = 0.1;
export function insuranceFeeFor(basePrice: number | string | null | undefined): number {
  const price = Number(String(basePrice ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(price) && price > 0 ? Math.round(price * INSURANCE_RATE * 100) / 100 : 0;
}
