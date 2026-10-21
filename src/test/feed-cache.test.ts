import { describe, expect, it } from 'vitest';
import { SharedFeedCache, SignedUrlMemo, loadWithSnapshot } from '@/lib/feed-cache';

describe('signed link memo', () => {
  it('reuses links signed within 5 hours and signs again afterwards', () => {
    let t = 0; const memo = new SignedUrlMemo(5 * 3600_000, 100, () => t);
    memo.set('a/1.jpg', 'u1');
    expect(memo.get('a/1.jpg')).toBe('u1');
    expect(memo.missing(['a/1.jpg', 'a/2.jpg'])).toEqual(['a/2.jpg']);
    t = 5 * 3600_000 + 1;
    expect(memo.get('a/1.jpg')).toBeUndefined();
    expect(memo.missing(['a/1.jpg'])).toEqual(['a/1.jpg']);
  });
  it('never grows past its limit', () => {
    const memo = new SignedUrlMemo(1000, 3, () => 0);
    for (const p of ['1', '2', '3', '4']) memo.set(p, p);
    expect(memo.get('4')).toBe('4');
    expect(memo.get('1')).toBeUndefined();
  });
});

describe('shared public feed', () => {
  it('builds once for simultaneous visitors and again after it expires', async () => {
    let t = 0, calls = 0; const cache = new SharedFeedCache<number>(1000, 60_000, 25_000, () => t);
    const load = async () => ++calls;
    const [a, b] = await Promise.all([cache.get(load), cache.get(load)]);
    expect([a, b, calls]).toEqual([1, 1, 1]);
    t = 999; expect(await cache.get(load)).toBe(1);
    t = 1000; expect(await cache.get(load)).toBe(2);
  });
  it('serves the last good feed when a refresh fails, and fails when nothing was ever loaded', async () => {
    let t = 0, fail = false; const cache = new SharedFeedCache<string>(1000, 60_000, 25_000, () => t);
    const load = async () => { if (fail) throw new Error('db down'); return 'feed'; };
    await expect(cache.get(async () => { throw new Error('first'); })).rejects.toThrow('first');
    expect(await cache.get(load)).toBe('feed');
    t = 2000; fail = true;
    expect(await cache.get(load)).toBe('feed');
    t = 61_000;
    await expect(cache.get(load)).rejects.toThrow('db down');
  });
  it('does not wait forever for a load that never finishes', async () => {
    let t = 0, n = 0; const cache = new SharedFeedCache<string>(1000, 60_000, 25_000, () => t);
    void cache.get(() => new Promise<string>(() => {}));
    t = 26_000;
    expect(await cache.get(async () => `second-${++n}`)).toBe('second-1');
  });
});

describe('saved feed copy', () => {
  const snap = (at: number) => async () => ({ at, data: 'saved' });
  it('uses a recent saved copy without rebuilding', async () => {
    let built = 0;
    const out = await loadWithSnapshot({ read: snap(1000), build: async () => { built++; return 'new'; }, write: async () => {}, ttlMs: 600_000, staleOkMs: 3_600_000, now: () => 2000 });
    expect([out, built]).toEqual(['saved', 0]);
  });
  it('rebuilds and saves when the copy is old or missing', async () => {
    let saved = '';
    const old = await loadWithSnapshot({ read: snap(0), build: async () => 'new', write: async d => { saved = d; }, ttlMs: 1000, staleOkMs: 9999, now: () => 5000 });
    expect([old, saved]).toEqual(['new', 'new']);
    const none = await loadWithSnapshot<string>({ read: async () => null, build: async () => 'fresh', write: async () => {}, ttlMs: 1000, staleOkMs: 9999 });
    expect(none).toBe('fresh');
  });
  it('still works when the table is missing or saving fails', async () => {
    const out = await loadWithSnapshot<string>({ read: async () => { throw new Error('no table'); }, build: async () => 'live', write: async () => { throw new Error('no table'); }, ttlMs: 1000, staleOkMs: 9999 });
    expect(out).toBe('live');
  });
  it('serves an older saved copy if the rebuild fails, but not an ancient one', async () => {
    const fail = async () => { throw new Error('db down'); };
    const out = await loadWithSnapshot({ read: snap(0), build: fail, write: async () => {}, ttlMs: 1000, staleOkMs: 10_000, now: () => 5000 });
    expect(out).toBe('saved');
    await expect(loadWithSnapshot({ read: snap(0), build: fail, write: async () => {}, ttlMs: 1000, staleOkMs: 10_000, now: () => 20_000 })).rejects.toThrow('db down');
  });
});
