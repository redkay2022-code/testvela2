/**
 * Bulk upload helpers (pure functions, no network): parse a table pasted from Excel / Google Sheets (or a CSV),
 * match each row to a video file by file name, group photos with their video, and validate every product.
 * One video = one product. Photos named "<video name>-1.jpg", "<video name>_2.png" … belong to that video.
 * Photos whose video does not exist are grouped by the name in front of the last "-number" ("<product>-1.jpg", "<product>-2.jpg" …) and become a photo-only product.
 */
import { productCategories } from '@/lib/catalog';
import { postCategoryLabels } from '@/lib/feed-categories';
import { DISPATCH_OPTIONS, dispatchValue } from '@/lib/dispatch';
import { isListingPhoto, isListingVideo, MAX_LISTING_PHOTOS, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES } from '@/lib/listing-media';
import { validatePostTitle } from '@/lib/post-title';
import { cleanWatchSpecs, numericSpecValue, watchSpecificationFields } from '@/lib/watch-specifications';
import { knownWatchBrand } from '@/lib/watch-brands';

export const MAX_BULK = 20;
export const BULK_FIELDS = ['file', 'title', 'price', 'category', 'source', 'factory', 'dispatch', 'boxPrice', 'brand', 'model', 'material', 'movement', 'caseSize', 'thickness', 'weight', 'glass', 'waterResistance', 'additionalDetails', 'description', 'menuCategory', 'sell'] as const;
export type BulkField = (typeof BULK_FIELDS)[number];
export type BulkValues = Record<BulkField, string>;
export const emptyValues = (): BulkValues => Object.fromEntries(BULK_FIELDS.map(f => [f, ''])) as BulkValues;

/** Header names accepted in the first row (Korean or English). Without a header row the column order above is used. */
const HEADER_ALIASES: Record<BulkField, string[]> = {
  file: ['파일명', '파일', 'file', 'filename'], title: ['제목', '상품명', 'title', 'name'], price: ['가격', '판매가격', '판매 가격', '수량', 'price'],
  category: ['카테고리', 'category'], source: ['출처', '제조/출처구분', '제조 / 출처 구분', '제조출처구분', 'source'], factory: ['공장', '공장선택', '출처직접입력', '출처/공장', '출처 / 공장', 'factory'],
  dispatch: ['발송', '예상발송시간', '예상 발송 시간', '발송시기', '발송 시기', 'dispatch'], boxPrice: ['풀셋박스추가금액', '풀셋 박스 추가 금액', '박스가격', '박스 가격', '박스', 'boxprice', 'box'],
  brand: ['브랜드', 'brand'], model: ['모델', '모델명', 'model'], material: ['케이스소재', '케이스 소재', '소재', 'material'],
  movement: ['무브먼트', 'movement'], caseSize: ['케이스직경', '케이스 직경', '케이스크기', '케이스 크기', '다이얼', 'casesize'],
  thickness: ['두께', 'thickness'], weight: ['무게', 'weight'], glass: ['글라스', 'glass'],
  waterResistance: ['방수', 'waterresistance'], additionalDetails: ['추가내용', '추가 내용', 'additionaldetails'], description: ['소개', '제품소개', '설명', 'description'], menuCategory: ['메뉴카테고리', '메뉴 카테고리', 'menucategory', 'menu'], sell: ['내용확인하기', '내용 확인하기', '마켓에판매하기', '마켓에 판매하기', '판매하기', '판매여부', '판매', 'sell', 'forsale'],
};

/** Splits one line of CSV / TSV, honouring "quoted, values". */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false; } else cur += c; }
    else if (c === '"' && cur === '') quoted = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/** Column order of the Excel sheet (used when the pasted text has no header row). */
export const PASTE_ORDER: readonly BulkField[] = ['file', 'menuCategory', 'title', 'description', 'category', 'sell', 'price', 'boxPrice', 'dispatch', 'brand', 'model', 'material', 'movement', 'caseSize', 'thickness', 'weight', 'glass', 'waterResistance', 'additionalDetails', 'source', 'factory'];

/** Spreadsheet text -> rows of values. Excel/Sheets copy gives tabs; CSV gives commas. Quoted cells may contain line breaks. */
export function parseTable(text: string): Partial<BulkValues>[] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const sep = clean.split('\n').slice(0, 5).some(l => l.includes('\t')) ? '\t' : ',';
  // join physical lines that sit inside an open quote
  const lines: string[] = []; let buf = '';
  for (const raw of clean.split('\n')) {
    buf = buf ? `${buf}\n${raw}` : raw;
    if ((buf.match(/"/g)?.length ?? 0) % 2 === 0) { if (buf.trim()) lines.push(buf); buf = ''; }
  }
  if (buf.trim()) lines.push(buf);
  if (!lines.length) return [];
  let order: BulkField[] = [...PASTE_ORDER];
  let start = 0;
  const first = splitLine(lines[0]!, sep).map(h => h.toLowerCase().replace(/\s+/g, ''));
  const mapped = first.map(h => BULK_FIELDS.find(f => HEADER_ALIASES[f].some(a => a.toLowerCase().replace(/\s+/g, '') === h)));
  if (mapped.filter(Boolean).length >= 2) { order = mapped.map((f, i) => f ?? (`__${i}` as BulkField)); start = 1; }
  return lines.slice(start).map(line => {
    const cells = splitLine(line, sep); const row: Partial<BulkValues> = {};
    order.forEach((f, i) => { if ((BULK_FIELDS as readonly string[]).includes(f) && cells[i] !== undefined) row[f] = cells[i]!; });
    return row;
  });
}

const MEDIA_EXT = /\.(mp4|mov|jpe?g|png|webp)$/i;
/** File name without a media extension ("dd(black).mp4" -> "dd(black)"); names without one stay as they are. */
const stem = (name: string) => name.replace(MEDIA_EXT, '');
const norm = (s: string) => s.normalize('NFC').trim().toLowerCase();

/** One product: a video product (video + photos) or a photo-only product (video = null). `name` is what the table's "파일명" refers to. */
export type BulkItem = { id: string; name: string; video: File | null; photos: File[]; values: BulkValues };

/** "<product>-3.jpg" / "<product>_3.jpg" -> { prefix: "<product>", n: 3 }. Names without a trailing number count as number 0 of their own product. */
export function photoParts(file: File): { prefix: string; n: number } {
  const base = stem(file.name).normalize('NFC').trim();
  const m = /^(.+?)[-_](\d+)$/.exec(base);
  return m ? { prefix: m[1]!.trim(), n: Number(m[2]) } : { prefix: base, n: 0 };
}
/** Number order (-2 before -10), then name. */
const byPhotoNumber = (a: File, b: File) => photoParts(a).n - photoParts(b).n || a.name.localeCompare(b.name, undefined, { numeric: true });

/**
 * Groups the chosen files. Each video is one product and takes the photos whose name starts with the video's name.
 * Remaining photos are grouped by the text before the last "-number" and become photo-only products.
 * Video products come first; the limit of MAX_BULK counts video and photo products together.
 */
export function groupFiles(files: File[]): { items: BulkItem[]; orphanPhotos: File[]; extraVideos: File[]; extraPhotoProducts: string[] } {
  const videos = files.filter(isListingVideo), photos = files.filter(isListingPhoto);
  const usedVideos = videos.slice(0, MAX_BULK);
  const items: BulkItem[] = usedVideos.map((video, i) => ({ id: `${i}-${video.name}-${video.size}`, name: video.name, video, photos: [], values: { ...emptyValues(), file: video.name } }));
  const byLength = [...items].sort((a, b) => stem(b.name).length - stem(a.name).length);
  const free: File[] = [];
  for (const photo of [...photos].sort(byPhotoNumber)) {
    const p = norm(stem(photo.name));
    const owner = byLength.find(it => { const v = norm(stem(it.name)); return p === v || (p.startsWith(v) && /^[-_ .(]/.test(p.slice(v.length))); });
    if (owner) owner.photos.push(photo); else free.push(photo);
  }
  const groups = new Map<string, { name: string; photos: File[] }>();
  for (const photo of free) {
    const { prefix } = photoParts(photo), key = norm(prefix);
    const g = groups.get(key); if (g) g.photos.push(photo); else groups.set(key, { name: prefix, photos: [photo] });
  }
  const extraPhotoProducts: string[] = [];
  [...groups.values()].forEach((g, i) => {
    if (items.length >= MAX_BULK) { extraPhotoProducts.push(g.name); return; }
    items.push({ id: `p${i}-${g.name}-${g.photos.reduce((n, f) => n + f.size, 0)}`, name: g.name, video: null, photos: g.photos, values: { ...emptyValues(), file: g.name } });
  });
  return { items, orphanPhotos: [], extraVideos: videos.slice(MAX_BULK), extraPhotoProducts };
}

/** Writes spreadsheet rows into the matching items (by file name with or without extension; if a row has no file name, by position). */
export function applyRows(items: BulkItem[], rows: Partial<BulkValues>[]): { items: BulkItem[]; unmatched: string[] } {
  const next = items.map(it => ({ ...it, values: { ...it.values } }));
  const unmatched: string[] = [];
  rows.forEach((row, index) => {
    const key = norm(row.file ?? '');
    if (!key && !(row.title ?? '').trim()) return; // untouched template rows (only default values) are ignored
    const wanted = norm(stem(row.file ?? ''));
    const target = key ? next.find(it => norm(it.name) === key || norm(stem(it.name)) === wanted) : next[index];
    if (!target) { unmatched.push(row.file || `#${index + 1}`); return; }
    for (const f of BULK_FIELDS) if (f !== 'file' && row[f] !== undefined && row[f] !== '') target.values[f] = row[f]!;
  });
  return { items: next, unmatched };
}

const SOURCE_ALIASES: Record<string, 'custom' | 'factory' | 'other'> = { '직접제작': 'custom', '직접 제작': 'custom', '커스텀': 'custom', '커스텀 제작': 'custom', '커스텀제작': 'custom', custom: 'custom', '공장': 'factory', '공장 선택': 'factory', '공장선택': 'factory', factory: 'factory', '기타': 'other', '기타 - 직접입력': 'other', '기타-직접입력': 'other', '기타 직접입력': 'other', '기타 (직접입력)': 'other', other: 'other' };
const SELL_YES = new Set(['예', '네', 'y', 'yes', 'true', '1', 'o', 'ㅇ', '판매', '체크', '✓', '✔']);
const SELL_NO = new Set(['아니오', '아니요', '아니', 'n', 'no', 'false', '0', 'x', 'ㄴ', '안함', '해제', '미판매']);
/** "마켓에 판매하기" checkbox: empty = checked (the bulk upload is for products). */
export function normalizeSell(raw: string): boolean | null { const t = norm(raw); if (!t || SELL_YES.has(t)) return true; if (SELL_NO.has(t)) return false; return null; }
export function normalizeDispatch(raw: string): { choice: string; custom: string } {
  const t = raw.trim();
  if (!t) return { choice: '7d', custom: '' };
  if (/^(바로|즉시|바로발송|바로 발송|immediate)$/i.test(t)) return { choice: 'immediate', custom: '' };
  const m = /^(\d{1,2})\s*(일|d|day|days)?(\s*이내)?$/i.exec(t);
  if (m) { const v = `${Number(m[1])}d`; if (DISPATCH_OPTIONS.some(o => o.value === v)) return { choice: v, custom: '' }; }
  return { choice: 'custom', custom: t };
}

const SPEC_UNIT: Record<string, string> = { caseSize: 'mm', thickness: 'mm', weight: 'g' };
const optionsOf = (key: string) => { const f = watchSpecificationFields.find(x => x.key === key); return f && 'options' in f ? (f.options as readonly string[]) : []; };
/** Same stored values as the single upload form: numbers get their unit ("40 mm"), selects use the form's own options. */
function watchSpecs(v: BulkValues, errors: string[], warnings: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const label = (k: string) => watchSpecificationFields.find(f => f.key === k)?.label ?? k;
  const brand = v.brand.trim();
  if (brand) { const known = knownWatchBrand(brand); if (!known) warnings.push(`브랜드 “${brand}”는 목록에 없어요. 그대로 저장돼요.`); out['brand'] = known ?? brand; }
  if (v.model.trim()) out['model'] = v.model.trim();
  const mat = v.material.trim();
  if (mat) out['material'] = optionsOf('material').find(o => norm(o) === norm(mat)) ?? mat;
  if (v.movement.trim()) out['movement'] = v.movement.trim();
  for (const k of ['caseSize', 'thickness', 'weight'] as const) {
    const raw = v[k].trim(); if (!raw) continue;
    const n = numericSpecValue(raw);
    if (!n) errors.push(`${label(k)}은(는) 숫자만 입력해 주세요. (예: 40)`); else out[k] = `${n} ${SPEC_UNIT[k]}`;
  }
  if (v.glass.trim()) out['glass'] = v.glass.trim();
  const wr = v.waterResistance.trim();
  if (wr) {
    const opts = optionsOf('waterResistance');
    const num = /^(\d+)\s*m?\b/i.exec(wr)?.[1];
    const hit = opts.find(o => norm(o) === norm(wr)) ?? (num ? opts.find(o => o.startsWith(`${num}m`)) : undefined) ?? (/1000/.test(wr) ? '1000m+' : undefined);
    if (!hit) warnings.push(`방수 “${wr}”는 선택 목록(${opts.join(', ')})에 없어요. 그대로 저장돼요.`);
    out['waterResistance'] = hit ?? wr;
  }
  if (v.additionalDetails.trim()) out['additionalDetails'] = v.additionalDetails.trim();
  return cleanWatchSpecs(out);
}

export type BulkPlan = { title: string; description: string; category: string; sell: boolean; price: number | null; boxPrice: number | null; dispatch: string | null; specs: Record<string, string> };

/** Returns every problem of one product (empty array = ready) plus the cleaned data to save. */
export function validateItem(item: BulkItem, existingTitles: Set<string>): { errors: string[]; warnings: string[]; plan: BulkPlan | null } {
  const v = item.values, errors: string[] = [], warnings: string[] = [];
  const titleError = validatePostTitle(v.title); if (titleError) errors.push(titleError);
  const sell = normalizeSell(v.sell);
  if (sell === null) errors.push('내용 확인하기는 예 / 아니오 중 하나로 입력해 주세요. (비우면 예)');
  const price = Number(v.price.replace(/[$,\s]/g, ''));
  if (sell !== false && (!Number.isFinite(price) || price < 1 || price > 100000000)) errors.push('수량은 1 이상의 숫자로 입력해 주세요.');
  const category = productCategories.find(c => norm(c) === norm(v.category)) ?? (v.category ? undefined : '커스텀제작');
  if (!category) errors.push(`카테고리는 ${productCategories.join(' / ')} 중 하나여야 해요.`);
  const menuCategory = v.menuCategory.trim() ? postCategoryLabels.find(c => norm(c) === norm(v.menuCategory)) : '시계';
  if (!menuCategory) errors.push(`메뉴 카테고리는 ${postCategoryLabels.join(' / ')} 중 하나여야 해요.`);
  else if (!v.menuCategory.trim()) warnings.push('메뉴 카테고리가 비어 있어 “시계”로 저장돼요.');
  const source = v.source ? SOURCE_ALIASES[norm(v.source)] : (v.factory ? 'factory' : 'custom');
  if (sell !== false && !source) errors.push('제조 / 출처 구분은 커스텀 제작 / 공장 선택 / 기타 - 직접입력 중 하나여야 해요.');
  if (sell !== false && (source === 'factory' || source === 'other') && !v.factory.trim()) errors.push('공장(출처)을 입력해 주세요.');
  const boxRaw = v.boxPrice.replace(/[$,\s]/g, ''); const box = boxRaw ? Number(boxRaw) : null;
  if (sell !== false && box !== null && (!Number.isFinite(box) || box < 0 || box > 100000000)) errors.push('박스 가격은 0 이상의 숫자로 입력해 주세요.');
  if (!item.video && item.photos.length === 0) errors.push('사진도 영상도 없는 묶음은 올릴 수 없어요.');
  if (item.video && item.video.size > MAX_VIDEO_BYTES) errors.push('영상은 최대 100MB까지 올릴 수 있어요.');
  if (item.photos.length > MAX_LISTING_PHOTOS) errors.push(`사진은 최대 ${MAX_LISTING_PHOTOS}장까지 올릴 수 있어요.`);
  if (item.photos.some(p => p.size > MAX_PHOTO_BYTES)) errors.push('사진은 장당 최대 10MB까지 올릴 수 있어요.');
  if (v.title.trim().length > 100) warnings.push('제목이 100자를 넘어 잘립니다.');
  if (existingTitles.has(norm(v.title))) warnings.push('같은 제목의 상품이 이미 있어요.');
  if (errors.length || sell === null || (sell && !source) || !category || !menuCategory) return { errors, warnings, plan: null };
  const d = normalizeDispatch(v.dispatch);
  const spec = watchSpecs(v, errors, warnings);
  if (errors.length) return { errors, warnings, plan: null };
  const specs: Record<string, string> = { ...spec };
  specs['menuCategory'] = menuCategory; if (sell && source) { specs['sourceType'] = source; if (source !== 'custom') specs['factory'] = v.factory.trim().slice(0, 80); }
  return { errors, warnings, plan: { title: v.title.trim().slice(0, 100), description: v.description.trim().slice(0, 3000), category, sell, price: sell ? Math.round(price) : null, boxPrice: sell && box !== null ? Math.round(box) : null, dispatch: sell ? dispatchValue(d.choice, d.custom) : null, specs } };
}

/** Decodes a CSV file: UTF-8 first, then EUC-KR (Excel on Korean Windows/Mac often saves CSV that way). */
export async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('euc-kr').decode(buf); }
}
