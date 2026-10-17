/**
 * HLS (.m3u8) playback helper.
 *
 * IMPORTANT: a client browser CANNOT convert an MP4 into HLS chunks. After a seller uploads a video, an external
 * streaming service (Mux, Bunny Stream or Cloudflare Stream) must create the .m3u8 manifest + segments. Store that
 * https .m3u8 URL in posts.video_url; this file only PLAYS such URLs. Plain MP4 URLs keep using the normal <video src>.
 * (Raw video files also cannot be compressed by this code; compression happens at upload time in video-compress.ts
 * or inside the streaming service.)
 *
 * The streaming service must output (1) several bitrate variants (e.g. 360p / 540p / 720p) so adaptive bitrate (ABR) can
 * switch down when the network slows, and (2) SHORT segments of 1-2 seconds. Segment length is decided on the server when the
 * stream is created; the player cannot change it. With short segments the config below starts playback after ~1 segment.
 *
 * hls.js is bundled with the site (npm package) but split into its own chunk, so it is downloaded only when the first
 * .m3u8 is about to play (warmHls() starts that download early). No third-party CDN is involved.
 */
type HlsInstance = { bandwidthEstimate?: number; loadSource(url: string): void; attachMedia(v: HTMLVideoElement): void; detachMedia(): void; stopLoad(): void; startLoad(): void; recoverMediaError(): void; destroy(): void; on(event: string, cb: (...a: unknown[]) => void): void };
type HlsStatic = { new (config?: Record<string, unknown>): HlsInstance; isSupported(): boolean; Events: Record<string, string> };

let loading: Promise<HlsStatic | null> | null = null;

/**
 * Last measured network speed (bits/s), shared by every video on the page. The first video measures the connection;
 * every following Short starts directly at the quality that connection can carry instead of starting blurry again.
 */
let lastBandwidth = 0;
const START_ESTIMATE = 3_000_000;

export const isHlsUrl = (url: string | null | undefined) => Boolean(url && /\.m3u8(\?|#|$)/i.test(url));

function loadHlsJs(): Promise<HlsStatic | null> {
  // One automatic retry: a single failed chunk download must not break every video until the page is reloaded.
  const once = () => import('hls.js').then(m => (m.default as unknown as HlsStatic) ?? null);
  loading ??= once()
    .catch(() => new Promise<HlsStatic | null>(r => setTimeout(() => once().then(r, () => r(null)), 1500)))
    .then(h => { if (!h) loading = null; return h; });
  return loading;
}

/** Safari (macOS / iOS) plays HLS natively and reliably. Other browsers that claim native HLS (newer Chrome) use hls.js. */
const preferNative = (v: HTMLVideoElement) =>
  typeof navigator !== 'undefined' && /Apple/.test(navigator.vendor || '') && v.canPlayType('application/vnd.apple.mpegurl') !== '';

/** Starts downloading the player code in the background (call when an HLS video is about to be shown). Safe to call often. */
export function warmHls(): void {
  if (typeof window === 'undefined') return;
  if (preferNative(document.createElement('video'))) return; // Safari / iOS play HLS natively
  void loadHlsJs();
}

export type HlsHandlers = { onBuffering?: (buffering: boolean) => void; onFatal?: () => void };

/**
 * Starts the stream on `video`. Returns a function that FULLY releases it: stops downloading, destroys the hls.js
 * instance, removes the source and unloads the element so nothing keeps downloading or holding memory in the background.
 */
export function attachHls(video: HTMLVideoElement, url: string, handlers: HlsHandlers = {}): () => void {
  let disposed = false;
  let hls: HlsInstance | null = null;
  const release = () => {
    disposed = true;
    if (hls) { const bw = hls.bandwidthEstimate; if (bw && Number.isFinite(bw) && bw > 0) lastBandwidth = bw; try { hls.stopLoad(); hls.detachMedia(); hls.destroy(); } catch { /* already gone */ } hls = null; }
    video.pause(); video.removeAttribute('src'); video.load();
  };
  // Safari / iOS: native HLS, no library needed.
  if (preferNative(video)) { video.src = url; return release; }
  void loadHlsJs().then(Hls => {
    if (disposed) return;
    if (!Hls || !Hls.isSupported()) {
      // Player code unavailable: try the browser's own HLS support before giving up.
      if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; return; }
      handlers.onFatal?.(); return;
    }
    const instance = new Hls({
      // --- Buffer enough ahead that the quality logic has time to step UP during a short clip. ---
      maxBufferLength: 12, maxMaxBufferLength: 30, maxBufferSize: 12 * 1000 * 1000, backBufferLength: 0, maxBufferHole: 0.5,
      startFragPrefetch: false,
      progressive: false, lowLatencyMode: false, enableWorker: true,
      // --- Adaptive bitrate (quality). ---
      // startLevel -1 = pick the starting quality from the measured speed (the first ever video measures it quickly on a
      // small segment). Quality then rises as soon as the connection allows it, and still drops quickly when it slows.
      // capLevelToPlayerSize keeps the quality matched to the screen size (including retina / high-DPI phones).
      startLevel: -1, testBandwidth: true, autoStartLoad: true, capLevelToPlayerSize: true, capLevelOnFPSDrop: true,
      abrEwmaDefaultEstimate: lastBandwidth || START_ESTIMATE, abrBandWidthFactor: 0.9, abrBandWidthUpFactor: 0.85, abrEwmaFastVoD: 3, abrEwmaSlowVoD: 9,
      // --- Slow or distant networks: wait longer and retry more before calling a request failed. ---
      manifestLoadingTimeOut: 15000, manifestLoadingMaxRetry: 4, manifestLoadingRetryDelay: 500,
      levelLoadingTimeOut: 15000, levelLoadingMaxRetry: 4, levelLoadingRetryDelay: 500,
      fragLoadingTimeOut: 20000, fragLoadingMaxRetry: 6, fragLoadingRetryDelay: 500,
    });
    hls = instance;
    const ev = Hls.Events;
    let netRetries = 0, mediaRecoveries = 0, retryTimer: ReturnType<typeof setTimeout> | undefined;
    instance.on(ev['ERROR'] ?? 'hlsError', (_e, data) => {
      const d = data as { fatal?: boolean; type?: string };
      if (!d?.fatal || disposed) return;
      if (d.type === 'networkError' && netRetries < 4) {
        // Back off 1s, 2s, 4s, 8s so a short network hiccup does not end playback.
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { if (!disposed) hls?.startLoad(); }, 1000 * 2 ** netRetries++);
      } else if (d.type === 'mediaError' && mediaRecoveries < 2) {
        mediaRecoveries++;
        hls?.recoverMediaError();
      } else {
        handlers.onFatal?.();
      }
    });
    // A healthy segment resets the counters, so later hiccups get the full number of retries again.
    instance.on(ev['FRAG_LOADED'] ?? 'hlsFragLoaded', () => { netRetries = 0; const bw = instance.bandwidthEstimate; if (bw && Number.isFinite(bw) && bw > 0) lastBandwidth = bw; });
    instance.attachMedia(video);
    instance.loadSource(url);
  });
  return release;
}
