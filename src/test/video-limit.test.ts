import { describe, expect, it } from 'vitest';
import { MAX_EDITOR_VIDEO_BYTES, MAX_VIDEO_BYTES, videoOverLimit } from '@/lib/listing-media';

describe('videos above the upload limits go to the editor first', () => {
  it('lets a video within 30 seconds and 100MB through', () => {
    expect(videoOverLimit({ size: MAX_VIDEO_BYTES }, 30)).toBe(false);
  });
  it('flags a video that is too big or too long', () => {
    expect(videoOverLimit({ size: MAX_VIDEO_BYTES + 1 }, 10)).toBe(true);
    expect(videoOverLimit({ size: 5 * 1024 * 1024 }, 45)).toBe(true);
    expect(videoOverLimit({ size: 5 * 1024 * 1024 }, Number.NaN)).toBe(true);
  });
  it('still accepts a 150MB video for editing, but not an absurdly large one', () => {
    expect(150 * 1024 * 1024 <= MAX_EDITOR_VIDEO_BYTES).toBe(true);
    expect(MAX_EDITOR_VIDEO_BYTES).toBeGreaterThan(MAX_VIDEO_BYTES);
  });
});
