import { tx } from '@/lib/dom-translate';

/** 판매 최고가(상품 + 풀셋 박스, USD). DB 함수 market_max_price_usd() 와 같은 값입니다. */
export const MAX_PRODUCT_PRICE_USD = 3500;
export const priceCapMessage = () => tx('판매 최고가는 $3,500(약 500만원)입니다. 가격을 낮춰 주세요.');
export const priceCapBuyMessage = () => tx('판매 최고가($3,500)를 넘는 상품은 구매할 수 없습니다.');
export const exceedsPriceCap = (price: number | null | undefined, box: number | null | undefined = 0) =>
  Number(price ?? 0) + Number(box ?? 0) > MAX_PRODUCT_PRICE_USD;
