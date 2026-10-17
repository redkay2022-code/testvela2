import { warmHls } from './hls-loader';
import { isMuxStreamUrl, muxThumbnailUrl } from './mux';

/**
 * Warms the browser cache with a product's first full-size photo when the visitor points at / touches its card,
 * so the product page opens with the picture already there. Skipped on "data saver" and very slow connections.
 * Each address is fetched at most once, and at most a few at the same time. It never throws.
 */
const started = new Set<string>();
let active = 0;
const MAX_ACTIVE = 3;

type NetInfo = { saveData?: boolean; effectiveType?: string };

/**
 * Called when the visitor touches / points at a video card: gets the Short ready before the tap finishes.
 * Mux videos: loads the player code, the small Mux poster and the stream's playlist (so the first segment is next).
 * Other videos fall back to the photo prefetch.
 */
export function prefetchShort(video: string | null | undefined, fallbackImage: string | null | undefined): void {
  try {
    if (!video || typeof window === 'undefined' || !isMuxStreamUrl(video)) { prefetchImage(fallbackImage); return; }
    const net = (navigator as Navigator & { connection?: NetInfo }).connection;
    if (net?.saveData || net?.effectiveType === 'slow-2g' || net?.effectiveType === '2g') return;
    warmHls();
    prefetchImage(muxThumbnailUrl(video, 720));
    if (started.has(video)) return;
    started.add(video);
    void fetch(video, { mode: 'cors', credentials: 'omit' }).catch(() => started.delete(video));
  } catch { /* prefetch is only a bonus */ }
}

export function prefetchImage(url: string | null | undefined): void {
  try {
    if (!url || typeof window === 'undefined' || started.has(url) || active >= MAX_ACTIVE) return;
    const net = (navigator as Navigator & { connection?: NetInfo }).connection;
    if (net?.saveData || net?.effectiveType === 'slow-2g' || net?.effectiveType === '2g') return;
    started.add(url);
    active++;
    const img = new Image();
    img.decoding = 'async';
    const finish = () => { active = Math.max(0, active - 1); };
    img.onload = finish;
    img.onerror = () => { finish(); started.delete(url); };
    img.src = url;
  } catch { /* prefetch is only a bonus */ }
}
