import { describe, expect, it } from 'vitest';
import { appendListingFiles } from '@/lib/listing-media';

describe('adding photos after editing a product video', () => {
  const video = new File(['edited'], 'edited.webm', { type: 'video/webm' });
  const photo = (i: number) => new File(['photo'], `${i}.jpg`, { type: 'image/jpeg' });
  it('keeps the edited video when photos are added later', () => {
    const firstPhoto = photo(0);
    const next = appendListingFiles([video, firstPhoto], [photo(1)]);
    expect(next).toHaveLength(3);
    expect(next[0]).toBe(video);
    expect(next[1]).toBe(firstPhoto);
  });
  it('accepts nine photos with one video but rejects a tenth photo', () => {
    const nine = appendListingFiles([video], Array.from({ length: 9 }, (_, i) => photo(i)));
    expect(nine).toHaveLength(10);
    expect(() => appendListingFiles(nine, [photo(10)])).toThrow('최대 9장');
  });
  it('rejects a second video without replacing the edited video', () => {
    expect(() => appendListingFiles([video], [new File(['new'], 'new.mp4', { type: 'video/mp4' })])).toThrow('1개');
  });
});