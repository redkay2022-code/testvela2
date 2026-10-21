import { describe, expect, it } from 'vitest';
import { emptyValues, validateItem, type BulkItem } from '@/lib/bulk-upload';

const photo = (name: string) => new File([new Uint8Array(10)], name, { type: 'image/jpeg' });
const item = (over: Partial<BulkItem> = {}): BulkItem => ({ id: 'a', name: '20260414_172108.mp4', video: null, photos: [photo('x-1.jpg')], values: emptyValues(), ...over });

describe('photo + video only upload (relaxed validation)', () => {
  it('still requires title and price in the normal table upload', () => {
    const r = validateItem(item(), new Set());
    expect(r.plan).toBeNull();
    expect(r.errors.length > 0).toBe(true);
  });
  it('accepts an item with no content: file name becomes the title and the product has no price', () => {
    const r = validateItem(item(), new Set(), true);
    expect(r.errors).toEqual([]);
    expect(r.plan?.title).toBe('20260414_172108');
    expect(r.plan?.price).toBeNull();
    expect(r.plan?.sell).toBe(false);
  });
  it('keeps what the seller typed', () => {
    const values = { ...emptyValues(), title: 'My watch', price: '120' };
    const r = validateItem(item({ values }), new Set(), true);
    expect(r.plan?.title).toBe('My watch');
    expect(r.plan?.price).toBe(120);
    expect(r.plan?.sell).toBe(true);
  });
  it('still rejects an item without any photo or video, and a wrongly typed price', () => {
    expect(validateItem(item({ photos: [] }), new Set(), true).plan).toBeNull();
    const values = { ...emptyValues(), price: 'abc', sell: '예' };
    expect(validateItem(item({ values }), new Set(), true).plan).toBeNull();
  });
  it('warns when a video is longer than 1 minute or there are more than 9 photos', () => {
    const video = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });
    const long = validateItem(item({ video }), new Set(), true, 75);
    expect(long.plan).toBeNull();
    expect(long.errors.some(e => e.includes('1분'))).toBe(true);
    expect(validateItem(item({ video }), new Set(), true, 60).plan === null).toBe(false);
    expect(validateItem(item({ video }), new Set(), true, 0).plan === null).toBe(false); // length not read yet: checked again at upload
    const many = validateItem(item({ photos: Array.from({ length: 10 }, (_, i) => photo(`p-${i}.jpg`)) }), new Set(), true);
    expect(many.plan).toBeNull();
    expect(many.errors.some(e => e.includes('9장'))).toBe(true);
    expect(validateItem(item({ photos: Array.from({ length: 9 }, (_, i) => photo(`p-${i}.jpg`)) }), new Set(), true).plan === null).toBe(false);
  });
  it('is ready with a video only, photos only, or both, with no warnings', () => {
    const video = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });
    for (const it2 of [item({ video, photos: [] }), item({ video: null }), item({ video })]) {
      const r = validateItem(it2, new Set(), true, 20);
      expect(r.errors).toEqual([]);
      expect(r.warnings).toEqual([]);
      expect(r.plan === null).toBe(false);
    }
  });
  it('ignores file sizes in the photo + video only upload (only photo count and video length block)', () => {
    const big = new File([new Uint8Array(10)], 'big.mp4', { type: 'video/mp4' });
    Object.defineProperty(big, 'size', { value: 301 * 1024 * 1024 });
    expect(validateItem(item({ video: big }), new Set(), true, 25).plan === null).toBe(false);
    expect(validateItem(item({ video: big }), new Set(), false, 25).plan).toBeNull(); // normal table upload keeps the 300MB rule
  });
});
