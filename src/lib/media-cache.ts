/**
 * Signed storage URLs carry a fresh token on every fetch, so the browser treated the same photo as a new
 * file after each refresh and downloaded it again. This keeps the first URL per file (remembered across
 * visits) so photos and videos come straight from the browser cache.
 */
const KEY = 'vela.media-urls.v1';
const REUSE_MS = 5 * 60 * 60 * 1000; // server signs for 6h; reuse for 5h
type Entry = { url: string; at: number };
let memory: Map<string, Entry> | null = null;

const keyOf = (url: string) => url.split('?')[0]!;
function load() {
  if (memory) return memory;
  memory = new Map();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) if (Date.now() - v.at < REUSE_MS) memory.set(k, v);
  } catch { /* storage unavailable */ }
  return memory;
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  if (typeof window === 'undefined') return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(load()))); } catch { /* full or blocked */ } }, 500);
}

export function stableUrl<T extends string | null | undefined>(url: T): T {
  if (!url || typeof window === 'undefined' || !url.includes('/storage/v1/object/sign/')) return url;
  const m = load(), k = keyOf(url), hit = m.get(k);
  if (hit && Date.now() - hit.at < REUSE_MS) return hit.url as T;
  m.set(k, { url, at: Date.now() }); persist();
  return url;
}

/** Forget a file whose cached URL stopped working, so the next fetch's fresh URL is used. */
export function forgetUrl(url: string) { load().delete(keyOf(url)); persist(); }

export function stabilizePosts<P extends { media_urls: string[]; video_url: string | null; thumbnail_url: string | null }>(posts: P[]): P[] {
  return posts.map(p => ({ ...p, media_urls: p.media_urls.map(u => stableUrl(u)), video_url: stableUrl(p.video_url), thumbnail_url: stableUrl(p.thumbnail_url) }));
}
