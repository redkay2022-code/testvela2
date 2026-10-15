/** 풀셋 박스 추가 금액(USD): 숫자를 입력하지 않으면 기본값 50을 쓴다. (0을 직접 입력하면 0 그대로) */
export const DEFAULT_BOX_PRICE = 50;

export function boxPriceOrDefault(raw: string | number | null | undefined): number {
  const text = String(raw ?? '').replace(/[$,\s]/g, '');
  if (!text) return DEFAULT_BOX_PRICE;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_BOX_PRICE;
}
