import { createMuxUpload } from './mux.functions';
import { putMarketMedia } from './market-upload';
import { compressVideoForWeb } from './video-compress';
import { faststartMp4 } from './mp4-faststart';
import { LONG_CACHE } from './image-compress';

export type ListingVideoUpload = {
  /** Value to store in posts.video_url ("mux-upload:<ref>" with Mux, a storage path otherwise). */
  videoUrl: string;
  /** Storage path to clean up if saving the post fails (null for Mux uploads). */
  storagePath: string | null;
  /** The file that was uploaded; use it for the poster frame. */
  file: File;
  /** True when the video went to Mux and is processed there. */
  mux: boolean;
};

/** PUTs the whole file to the Mux upload URL, reporting progress (0..1). */
function putToMux(url: string, file: File, onProgress?: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`mux upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('mux upload network error'));
    xhr.send(file);
  });
}

/**
 * Uploads a listing video.
 *  - Mux configured: the ORIGINAL file goes straight to Mux, which encodes HLS in several qualities. No in-browser re-encoding.
 *  - Mux not configured: falls back to the previous behaviour (in-browser compression + Supabase Storage).
 * `folder` is the storage folder of the listing owner (used only by the fallback).
 * `compress: false` (lounge videos, up to 5 minutes) skips the slow in-browser re-encoding in the fallback and only moves the MP4 index to the front.
 */
export async function uploadListingVideo(file: File, folder: string, onProgress?: (ratio: number) => void, options: { compress?: boolean } = {}): Promise<ListingVideoUpload> {
  const mux = await createMuxUpload();
  if (mux.enabled) {
    try { await putToMux(mux.uploadUrl, file, onProgress); }
    catch { throw new Error('영상을 올리지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'); }
    return { videoUrl: mux.videoUrl, storagePath: null, file, mux: true };
  }
  const ready = options.compress === false ? await faststartMp4(file).catch(() => file) : await compressVideoForWeb(file, onProgress);
  const ext = ready.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await putMarketMedia(path, ready, { cacheControl: LONG_CACHE });
  if (error) throw new Error('영상을 올리지 못했어요. 다시 시도해 주세요.');
  return { videoUrl: path, storagePath: path, file: ready, mux: false };
}
