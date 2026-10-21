/**
 * Server-side helpers that keep the public feed fast.
 *
 * - SignedUrlMemo: signing thousands of storage paths on every feed build was the slowest step. A signed link stays
 *   valid for 6 hours, so a link signed in the last 5 hours is reused instead of asking storage to sign it again.
 * - SharedFeedCache: visitors who are not signed in all get the same feed. It is shared for a short time, a request
 *   that finds a load already running waits for that one (unless it looks stuck), and if a refresh fails the last
 *   good feed is served instead of an error page.
 */
type Clock = () => number;

export class SignedUrlMemo {
  private readonly items = new Map<string, { url: string; at: number }>();
  constructor(private readonly reuseMs = 5 * 60 * 60 * 1000, private readonly max = 20_000, private readonly now: Clock = Date.now) {}

  get(path: string): string | undefined {
    const hit = this.items.get(path);
    if (!hit) return undefined;
    if (this.now() - hit.at >= this.reuseMs) { this.items.delete(path); return undefined; }
    return hit.url;
  }

  set(path: string, url: string) {
    if (this.items.size >= this.max && !this.items.has(path)) this.items.clear();
    this.items.set(path, { url, at: this.now() });
  }

  /** Paths that still need signing (not remembered or expired). */
  missing(paths: string[]): string[] { return paths.filter(p => this.get(p) === undefined); }
}

export class SharedFeedCache<T> {
  private value: { at: number; data: T } | null = null;
  private loading: { startedAt: number; promise: Promise<T> } | null = null;
  constructor(
    private readonly freshMs = 120_000,
    private readonly staleOnErrorMs = 30 * 60_000,
    private readonly loadingMaxMs = 25_000,
    private readonly now: Clock = Date.now,
  ) {}

  async get(load: () => Promise<T>): Promise<T> {
    const t = this.now();
    if (this.value && t - this.value.at < this.freshMs) return this.value.data;
    if (!this.loading || t - this.loading.startedAt > this.loadingMaxMs) {
      const promise = load().then(data => { this.value = { at: this.now(), data }; return data; });
      const entry = { startedAt: t, promise };
      this.loading = entry;
      const clear = () => { if (this.loading === entry) this.loading = null; };
      promise.then(clear, clear);
    }
    const running = this.loading.promise;
    try { return await running; }
    catch (error) {
      if (this.value && this.now() - this.value.at < this.staleOnErrorMs) return this.value.data;
      throw error;
    }
  }

  clear() { this.value = null; this.loading = null; }
}
