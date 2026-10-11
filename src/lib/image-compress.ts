/**
 * Shrinks a photo in the browser before upload (max 1600px, WebP ~0.82).
 * Phone photos are often 4-10MB; the feed only needs a fraction of that, so pages load much faster.
 * Falls back to the original file whenever anything is unsupported or the result is not smaller.
 */
export const MAX_PHOTO_EDGE = 1600;

export async function compressImage(file: File, maxEdge = MAX_PHOTO_EDGE, quality = 0.82): Promise<File> {
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || typeof createImageBitmap !== 'function') return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp', lastModified: Date.now() });
  } catch { return file; }
}

/** Long-lived browser caching: every uploaded file gets a unique random path, so it never changes. */
export const LONG_CACHE = '31536000';
