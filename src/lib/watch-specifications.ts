export const watchSpecificationFields = [
  { key: 'brand', label: '브랜드', kind: 'brand' },
  { key: 'model', label: '모델명', kind: 'text', placeholder: 'Daytona 116500LN, Nautilus 5712, Royal Oak' },
  { key: 'material', label: '케이스 소재', kind: 'select', custom: true, options: ['904L stainless', '316L stainless', 'Stainless Steel', 'Tungsten(weighted)', '18k gold wrapped', 'Platinum wrapped', 'Carbon', 'Ceramic'] },
  { key: 'movement', label: '무브먼트', kind: 'text', placeholder: 'Automatic, Manual Winding, Quartz, Tourbillon 등 직접 입력' },
  { key: 'caseSize', label: '케이스 직경', kind: 'number', unit: 'mm', placeholder: '40' },
  { key: 'thickness', label: '두께', kind: 'number', unit: 'mm', placeholder: '12.5' },
  { key: 'weight', label: '무게', kind: 'number', unit: 'g', placeholder: '155' },
  { key: 'glass', label: '글라스', kind: 'text', placeholder: 'Sapphire Crystal, Mineral Glass 등 직접 입력' },
  { key: 'waterResistance', label: '방수', kind: 'select', options: ['30m / 3 ATM', '50m / 5 ATM', '100m / 10 ATM', '300m / 30 ATM', '1000m+'] },
  { key: 'additionalDetails', label: '추가 내용', kind: 'textarea', placeholder: '다이얼, 금 도금·래핑, 커스텀 부품, 보증 상태, 포함 액세서리 등' },
] as const;

export function numericSpecValue(value: string): string {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:mm|g|hours?|시간)?$/i);
  return match?.[1] ?? '';
}

/** Keep existing JSON keys and unit-bearing values; do not truncate multi-line details to 80 characters. */
export function cleanWatchSpecs(specs: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(specs)
    .map(([key, value]) => [key, value.trim().slice(0, key === 'additionalDetails' ? 3000 : 80)])
    .filter(([, value]) => Boolean(value)));
}