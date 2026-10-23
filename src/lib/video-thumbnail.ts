import { putMarketMedia } from './market-upload';

/** Captures one JPEG frame (~1s in, or the middle of short clips) from a local video file in the browser. */
export async function captureVideoFrame(file: Blob, maxWidth = 720, startTime = 1): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<Blob | null>(resolve => {
      const video = document.createElement('video');
      const done = (b: Blob | null) => { clearTimeout(timer); resolve(b); };
      const timer = setTimeout(() => done(null), 15000);
      video.muted = true; video.playsInline = true; video.preload = 'auto';
      video.onerror = () => done(null);
      video.onloadeddata = () => {
        const d = Number.isFinite(video.duration) ? video.duration : 2;
        video.currentTime = Math.min(startTime, d / 2);
      };
      video.onseeked = () => {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return done(null);
        const scale = Math.min(1, maxWidth / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return done(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => done(b), 'image/jpeg', 0.82);
      };
      video.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

/** Generates and uploads a thumbnail for a video; returns the storage path, or null if capture fails (never blocks the upload). */
export async function uploadVideoThumbnail(file: Blob, folder: string): Promise<string | null> {
  const frame = await captureVideoFrame(file).catch(() => null);
  if (!frame) return null;
  const path = `${folder}/${crypto.randomUUID()}-thumb.jpg`;
  const { error } = await putMarketMedia(path, frame, { contentType: 'image/jpeg' });
  return error ? null : path;
}

/** 셀러가 직접 고른 썸네일(영상에서 고른 장면 또는 첨부한 사진)을 가로 720px 이하 JPEG로 줄여 올린다. 실패하면 null(자동 썸네일을 쓴다). */
export async function uploadCoverThumbnail(image: Blob, folder: string, maxWidth = 720): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(image);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.85));
    if (!blob) return null;
    const path = `${folder}/${crypto.randomUUID()}-thumb.jpg`;
    const { error } = await putMarketMedia(path, blob, { contentType: 'image/jpeg' });
    return error ? null : path;
  } catch { return null; }
}
