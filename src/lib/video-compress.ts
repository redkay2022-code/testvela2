/**
 * Smart in-browser video preparation before upload.
 *
 *  1. A clip that is already light (<= ~2.8 Mbps and <= 1280px on the long edge) is uploaded untouched: no quality loss, no waiting.
 *  2. A heavy clip (a 4K phone video of 100MB, say) is re-encoded to a web-friendly MP4 (WebM where MP4 recording is unavailable):
 *     long edge <= 1280px, short edge <= 720px, up to ~2.5 Mbps. The result starts and plays without buffering.
 *  3. The converted clip is compared with the original on a few sample frames. If it looks clearly worse, or is not
 *     meaningfully smaller, the ORIGINAL file is uploaded instead (it is then served with the player-side preloading).
 *
 * Re-encoding runs in real time (a 30s clip takes ~30s). Any failure falls back to the original file.
 */
import { faststartMp4 } from './mp4-faststart';

export const COMPRESS_THRESHOLD_BYTES = 1_500_000;
/** Slight lift applied while re-encoding: browser re-encoding tends to look a little flat and dark, so the result is kept at least as bright as the original. */
const LIFT_FILTER = 'brightness(1.07) contrast(1.03) saturate(1.04)';
const canFilter = (ctx: CanvasRenderingContext2D) => 'filter' in ctx;
/** Clips at or below this bitrate (bits/s) and size are already web-friendly. */
const LIGHT_BITRATE = 2_200_000;
/** Minimum average PSNR (dB) of the sampled frames for the converted clip to be accepted. Lower = more permissive. */
const MIN_PSNR = 27;

export type VideoConvertReason = 'converted' | 'already-light' | 'unsupported' | 'quality' | 'not-smaller' | 'failed';
export type VideoConvertResult = { file: File; converted: boolean; reason: VideoConvertReason };

function waitFor(target: EventTarget, okEvent: string, ms = 8000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { window.clearTimeout(timer); target.removeEventListener(okEvent, onOk); target.removeEventListener('error', onBad); };
    const onOk = () => { cleanup(); resolve(); };
    const onBad = () => { cleanup(); reject(new Error(`${okEvent} failed`)); };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error(`${okEvent} timeout`)); }, ms);
    target.addEventListener(okEvent, onOk); target.addEventListener('error', onBad);
  });
}
async function seekTo(video: HTMLVideoElement, time: number) { const done = waitFor(video, 'seeked', 3000); video.currentTime = time; await done; }
function lumaOf(video: HTMLVideoElement, w: number, h: number, ctx: CanvasRenderingContext2D, lift = false) {
  if (lift && canFilter(ctx)) ctx.filter = LIFT_FILTER;
  ctx.drawImage(video, 0, 0, w, h);
  if (lift && canFilter(ctx)) ctx.filter = 'none';
  const px = ctx.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = 0.299 * (px[j] ?? 0) + 0.587 * (px[j + 1] ?? 0) + 0.114 * (px[j + 2] ?? 0);
  return out;
}
/** Average PSNR (dB) between the original and the converted clip on three sample frames, or null when it could not be measured. */
async function averagePsnr(original: HTMLVideoElement, converted: Blob, duration: number): Promise<number | null> {
  const url = URL.createObjectURL(converted), other = document.createElement('video');
  other.muted = true; other.playsInline = true; other.preload = 'auto'; other.src = url;
  try {
    await waitFor(other, 'loadedmetadata');
    const cw = other.videoWidth, ch = other.videoHeight;
    if (!cw || !ch) return null;
    const W = 160, H = Math.max(2, Math.round((W * ch) / cw));
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    const deadline = Date.now() + 10_000, scores: number[] = [];
    for (const ratio of [0.2, 0.5, 0.8]) {
      if (Date.now() > deadline) break;
      try {
        const at = Math.max(0.05, duration * ratio);
        await seekTo(original, at); await seekTo(other, at);
        const a = lumaOf(original, W, H, ctx, true), b = lumaOf(other, W, H, ctx);
        let sum = 0; for (let i = 0; i < a.length; i++) { const d = (a[i] ?? 0) - (b[i] ?? 0); sum += d * d; }
        const mse = sum / a.length;
        scores.push(mse < 0.01 ? 60 : 10 * Math.log10((255 * 255) / mse));
      } catch { /* this sample could not be compared */ }
    }
    return scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : null;
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

async function convertCore(file: File, onProgress?: (ratio: number) => void): Promise<VideoConvertResult> {
  const keep = (reason: VideoConvertReason): VideoConvertResult => ({ file, converted: false, reason });
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') return keep('unsupported');
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return keep('already-light');
  if (/^vela-edit-/.test(file.name)) return keep('already-light'); // exported by the editor: already sized and colour-adjusted
  const url = URL.createObjectURL(file);
  let ac: AudioContext | null = null;
  try {
    const v = document.createElement('video');
    v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise<void>((resolve, reject) => { v.onloadedmetadata = () => resolve(); v.onerror = () => reject(new Error('metadata')); });
    const w0 = v.videoWidth, h0 = v.videoHeight, duration = v.duration;
    if (!w0 || !h0 || !Number.isFinite(duration) || duration <= 0) return keep('failed');
    if ((file.size * 8) / duration <= LIGHT_BITRATE && Math.max(w0, h0) <= 1280) return keep('already-light');

    const scale = Math.min(1, 1280 / Math.max(w0, h0), 720 / Math.min(w0, h0));
    const W = Math.max(2, Math.round((w0 * scale) / 2) * 2), H = Math.max(2, Math.round((h0 * scale) / 2) * 2);
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return keep('failed');
    const stream = canvas.captureStream(30);
    try {
      ac = new AudioContext(); const dest = ac.createMediaStreamDestination();
      ac.createMediaElementSource(v).connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      await ac.resume();
    } catch { /* no audio track: keep the picture */ }
    const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) return keep('unsupported');
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(Math.min(2_000_000, Math.max(900_000, W * H * 2.2))), audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>(resolve => { rec.onstop = () => resolve(); });
    rec.start(500);
    await v.play();
    await new Promise<void>(resolve => {
      const guard = window.setTimeout(resolve, (duration + 8) * 1000);
      const tick = () => {
        if (canFilter(ctx)) ctx.filter = LIFT_FILTER;
        ctx.drawImage(v, 0, 0, W, H);
        onProgress?.(Math.min(0.85, (v.currentTime / duration) * 0.85));
        if (v.ended || v.currentTime >= duration - 0.05) { window.clearTimeout(guard); resolve(); } else requestAnimationFrame(tick);
      };
      tick();
    });
    v.pause(); rec.stop(); await stopped;
    const out = new Blob(chunks, { type: mime.split(';')[0] ?? 'video/webm' });
    if (!out.size) return keep('failed');
    if (out.size >= file.size * 0.9) return keep('not-smaller');
    onProgress?.(0.9);
    const psnr = await averagePsnr(v, out, duration);
    if (psnr !== null && psnr < MIN_PSNR) return keep('quality');
    onProgress?.(1);
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    return { file: new File([out], file.name.replace(/\.[^.]+$/, '') + `-web.${ext}`, { type: out.type, lastModified: Date.now() }), converted: true, reason: 'converted' };
  } catch { return keep('failed'); }
  finally { URL.revokeObjectURL(url); void ac?.close().catch(() => undefined); }
}

/** Converts when worthwhile, then (for MP4 / MOV that stay untouched) moves the index to the front so playback starts without downloading the whole file. */
export async function convertVideoSmart(file: File, onProgress?: (ratio: number) => void): Promise<VideoConvertResult> {
  const result = await convertCore(file, onProgress);
  if (result.converted) return result;
  return { ...result, file: await faststartMp4(result.file) };
}

/** Backwards-compatible helper: returns the converted file, or the original when conversion is not worthwhile or not possible. */
export async function compressVideoForWeb(file: File, onProgress?: (ratio: number) => void): Promise<File> {
  return (await convertVideoSmart(file, onProgress)).file;
}
