/**
 * HLS (.m3u8) playback helper.
 *
 * IMPORTANT: a client browser CANNOT convert an MP4 into HLS chunks. After a seller uploads a video, an external
 * streaming service (Mux, Bunny Stream or Cloudflare Stream) must create the .m3u8 manifest + segments. Store that
 * https .m3u8 URL in posts.video_url; this file only PLAYS such URLs. Plain MP4 URLs keep using the normal <video src>.
 * (Raw video files also cannot be compressed by this code; compression happens at upload time in video-compress.ts
 * or inside the streaming service.)
 *
 * hls.js is loaded on demand from a CDN the first time an .m3u8 is needed, so it adds nothing to the normal bundle.
 */
type HlsInstance = { loadSource(url: string): void; attachMedia(v: HTMLVideoElement): void; detachMedia(): void; stopLoad(): void; startLoad(): void; recoverMediaError(): void; destroy(): void; on(event: string, cb: (...a: unknown[]) => void): void };
type HlsStatic = { new (config?: Record<string, unknown>): HlsInstance; isSupported(): boolean; Events: Record<string, string> };

const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
let loading: Promise<HlsStatic | null> | null = null;

export const isHlsUrl = (url: string | null | undefined) => Boolean(url && /\.m3u8(\?|#|$)/i.test(url));

function loadHlsJs(): Promise<HlsStatic | null> {
  const w = window as unknown as { Hls?: HlsStatic };
  if (w.Hls) return Promise.resolve(w.Hls);
  loading ??= new Promise<HlsStatic | null>(resolve => {
    const s = document.createElement('script');
    s.src = HLS_JS; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => resolve(w.Hls ?? null);
    s.onerror = () => { loading = null; resolve(null); };
    document.head.appendChild(s);
  });
  return loading;
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
    if (hls) { try { hls.stopLoad(); hls.detachMedia(); hls.destroy(); } catch { /* already gone */ } hls = null; }
    video.pause(); video.removeAttribute('src'); video.load();
  };
  // Safari / iOS: native HLS, no library needed.
  if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; return release; }
  void loadHlsJs().then(Hls => {
    if (disposed) return;
    if (!Hls || !Hls.isSupported()) { handlers.onFatal?.(); return; }
    hls = new Hls({
      // Small buffers + start low and ramp up: fast first frame and low memory on phones such as the Galaxy Fold6.
      maxBufferLength: 8, maxMaxBufferLength: 16, backBufferLength: 0, maxBufferSize: 20 * 1000 * 1000,
      capLevelToPlayerSize: true, startLevel: 0, abrEwmaDefaultEstimate: 2_000_000, lowLatencyMode: false, enableWorker: true,
    });
    const ev = Hls.Events;
    let netRetries = 0;
    hls.on(ev.ERROR ?? 'hlsError', (_e, data) => {
      const d = data as { fatal?: boolean; type?: string };
      if (!d?.fatal || disposed) return;
      if (d.type === 'networkError' && netRetries++ < 2) hls?.startLoad();
      else if (d.type === 'mediaError') hls?.recoverMediaError();
      else { handlers.onFatal?.(); }
    });
    hls.attachMedia(video);
    hls.loadSource(url);
  });
  return release;
}
