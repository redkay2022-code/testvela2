/**
 * Shrinks a video in the browser before upload: long edge <= 1280px, short edge <= 720px, ~2 Mbps, H.264 MP4 when the
 * browser can record it (otherwise WebM). A 4K phone clip of 100MB becomes a few MB, so it starts and plays without buffering.
 * It re-records the video in real time (a 20s clip takes ~20s). Falls back to the original file on any problem.
 */
export const COMPRESS_THRESHOLD_BYTES = 4 * 1024 * 1024;

export async function compressVideoForWeb(file: File, onProgress?: (ratio: number) => void): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_BYTES || typeof MediaRecorder === 'undefined') return file;
  const url = URL.createObjectURL(file);
  let ac: AudioContext | null = null;
  try {
    const v = document.createElement('video');
    v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise<void>((resolve, reject) => { v.onloadedmetadata = () => resolve(); v.onerror = () => reject(new Error('metadata')); });
    const w0 = v.videoWidth, h0 = v.videoHeight;
    if (!w0 || !h0 || !Number.isFinite(v.duration)) return file;
    const scale = Math.min(1, 1280 / Math.max(w0, h0), 720 / Math.min(w0, h0));
    const W = Math.max(2, Math.round((w0 * scale) / 2) * 2), H = Math.max(2, Math.round((h0 * scale) / 2) * 2);
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    const stream = canvas.captureStream(30);
    try {
      ac = new AudioContext(); const dest = ac.createMediaStreamDestination();
      ac.createMediaElementSource(v).connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      await ac.resume();
    } catch { /* no audio track: keep the picture */ }
    const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) return file;
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(Math.min(2_500_000, W * H * 2.4)), audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>(resolve => { rec.onstop = () => resolve(); });
    rec.start(500);
    await v.play();
    await new Promise<void>(resolve => {
      const guard = window.setTimeout(resolve, (v.duration + 8) * 1000);
      const tick = () => {
        ctx.drawImage(v, 0, 0, W, H);
        onProgress?.(Math.min(1, v.currentTime / v.duration));
        if (v.ended || v.currentTime >= v.duration - 0.05) { window.clearTimeout(guard); resolve(); } else requestAnimationFrame(tick);
      };
      tick();
    });
    v.pause(); rec.stop(); await stopped;
    const out = new Blob(chunks, { type: mime.split(';')[0] ?? 'video/webm' });
    if (!out.size || out.size >= file.size) return file;
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    return new File([out], file.name.replace(/\.[^.]+$/, '') + `-web.${ext}`, { type: out.type, lastModified: Date.now() });
  } catch { return file; }
  finally { URL.revokeObjectURL(url); void ac?.close().catch(() => undefined); }
}
