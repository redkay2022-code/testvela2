/** Seller approval welcome message: stored once per approval, rendered per locale. */
export const SELLER_WELCOME_KIND = 'seller_welcome';
export const SELLER_WELCOME_TITLE = '🎉 Welcome to VELA! 셀러 입점을 축하합니다.';
export const SELLER_WELCOME_CTA_URL = '/upload';
export const WELCOME_FACTORIES = ['VSF', 'ZF', '3KF', 'RC', 'RG', 'UMI', 'Rich', 'Custom'] as const;
export const MAX_TIER_COMMISSION_DISCOUNT_PCT = 5;

type Copy = { intro: string; rules: [string, string][]; cta: string };
const f = WELCOME_FACTORIES.join(', ');
export const sellerWelcomeCopy: Record<'ko' | 'en', Copy> = {
  ko: {
    intro: 'VELA Studio Partner가 되신 것을 진심으로 축하드립니다. VELA에서 큰 성공을 거두시길 바랍니다.',
    rules: [
      ['1) 공장 표기 정확성', `모든 상품은 정확한 제작 공장(${f} 등)을 반드시 표기해야 합니다. 허위 표기 시 즉시 판매 정지 및 에스크로 동결 조치됩니다.`],
      ['2) VELA 물류 & 배송 보험', '모든 상품은 VELA 계약 물류사를 통해서만 발송됩니다. VELA가 구매자로부터 배송 보험료를 받고, 배송 중 분실·파손에 대해 플랫폼이 전적으로 책임집니다.'],
      ['3) 출고 전 QC & 교환 규정', '발송 전 엄격한 품질 검수(QC)를 해야 합니다. 구매자가 불량 또는 작동하지 않는 상품을 받으면 셀러는 즉시 새 상품으로 교환 발송해야 합니다.'],
      ['4) Crypto 에스크로 & Studio 등급', `대금은 배송 완료·구매 확정 후 에스크로에서 정산됩니다. STANDARD, PRO, PRIME, MASTER 등급에 따라 최대 ${MAX_TIER_COMMISSION_DISCOUNT_PCT}% 수수료 할인 혜택이 있습니다.`],
    ],
    cta: 'Studio Center로 이동 / 첫 상품 등록',
  },
  en: {
    intro: 'Congratulations on becoming a VELA Studio Partner. We wish you great success on the platform.',
    rules: [
      ['1) Factory Listing Accuracy', `Every listing must declare its exact factory source (${f}, etc.). False listings result in an immediate seller ban and escrow freeze.`],
      ['2) VELA Logistics & Shipping Insurance', "All products ship exclusively via VELA's contracted logistics partner. VELA collects shipping insurance from buyers and takes full platform responsibility for loss or damage in transit."],
      ['3) Mandatory Pre-shipment QC & Replacement', 'Perform strict QC before dispatch. If a buyer receives a defective or non-working item, you must immediately ship a brand-new replacement.'],
      ['4) Crypto Escrow & Studio Tiers', `Payouts settle from escrow after delivery and purchase confirmation. STANDARD, PRO, PRIME and MASTER tiers unlock up to ${MAX_TIER_COMMISSION_DISCOUNT_PCT}% commission discounts.`],
    ],
    cta: 'Go to Studio Center / Upload First Product',
  },
};
export const sellerWelcomeBody = (lang: string) => { const c = sellerWelcomeCopy[lang === 'ko' ? 'ko' : 'en']; return [c.intro, ...c.rules.map(([h, b]) => `${h}: ${b}`)].join('\n\n'); };
