/** Shared catalog rules. The database trigger `sync_product_status` enforces the same rules server-side. */
export const productStatuses = ['DRAFT', 'READY', 'PUBLISHED', 'OUT_OF_STOCK', 'ARCHIVED'] as const;
export type ProductStatus = typeof productStatuses[number];
export const storeStatuses = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
export const verificationStatuses = ['UNVERIFIED', 'VERIFIED', 'PREMIUM', 'MASTER'] as const;
export const imageKinds = ['main', 'gallery', 'dial', 'case', 'caseback', 'movement', 'bracelet', 'clasp', 'detail', 'qc'] as const;
export type ImageKind = typeof imageKinds[number];
export const productCategories = ['커스텀제작', '공장 생산', '제작 과정', '기타', '악세사리'] as const;
export const watchSpecFields = [
  ['caseSize', 'Case Size'], ['material', 'Case Material'], ['dial', 'Dial'], ['glass', 'Crystal'], ['bezel', 'Bezel'], ['bracelet', 'Bracelet'],
  ['clasp', 'Clasp'], ['movement', 'Movement'], ['powerReserve', 'Power Reserve'], ['waterResistance', 'Water Resistance'], ['caseback', 'Caseback'], ['functions', 'Functions'],
] as const;

export const availableQty = (stock: number, reserved: number) => Math.max(0, stock - reserved);

/** Applies the automatic stock transition: PUBLISHED ⇄ OUT_OF_STOCK when available quantity hits 0 or is restocked. */
export function resolveProductStatus(requested: ProductStatus, stock: number, reserved: number): ProductStatus {
  const available = availableQty(stock, reserved);
  if (requested === 'PUBLISHED' && available <= 0) return 'OUT_OF_STOCK';
  if (requested === 'OUT_OF_STOCK' && available > 0) return 'PUBLISHED';
  return requested;
}

/** Only these statuses are visible to customers. */
export const isCustomerVisible = (status: ProductStatus | null | undefined) => status === 'PUBLISHED' || status === 'OUT_OF_STOCK';

export type PublishInput = { title: string; storeId: string | null; category: string; price: number | null; stock: number; hasMainImage: boolean };
/** Required fields before a product may be published: name, store, category, price, stock and main image. */
export function publishBlockers(p: PublishInput): string[] {
  const missing: string[] = [];
  if (!p.title.trim()) missing.push('상품명');
  if (!p.storeId) missing.push('스토어');
  if (!p.category) missing.push('카테고리');
  if (p.price === null || !(p.price > 0)) missing.push('가격');
  if (!Number.isInteger(p.stock) || p.stock < 0) missing.push('재고');
  if (!p.hasMainImage) missing.push('대표 이미지');
  return missing;
}

export const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
