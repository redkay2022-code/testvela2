export const MAX_LISTING_PHOTOS = 9;
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;
/** Videos above 300MB / 1 minute may still be PICKED so the editor can trim them; only absurdly huge files are refused. */
export const MAX_EDITOR_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
/** True when a video is above the upload limits and has to be trimmed in the editor first. */
export const videoOverLimit = (file: { size: number }, seconds: number) => file.size > MAX_VIDEO_BYTES || !Number.isFinite(seconds) || seconds > MAX_VIDEO_SECONDS + 0.05;

export function isListingVideo(file: File) {
  return file.type === 'video/mp4' || file.type === 'video/quicktime' || file.type === 'video/webm' || /\.(mp4|mov|webm)$/i.test(file.name);
}

export function isListingPhoto(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

/** Add media without replacing an existing edited video or photo selection. */
export function appendListingFiles(existing: File[], selected: File[]): File[] {
  const next = [...existing, ...selected];
  if (next.filter(isListingPhoto).length > MAX_LISTING_PHOTOS) throw new Error(`사진은 최대 ${MAX_LISTING_PHOTOS}장까지 올릴 수 있어요.`);
  if (next.filter(isListingVideo).length > 1) throw new Error('영상은 상품당 1개만 올릴 수 있어요.');
  return next;
}

export async function readVideoDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      // 휴대폰(특히 iPhone)에서는 정보 읽기 이벤트가 끝내 오지 않는 경우가 있어, 8초 뒤에는 길이 확인 없이 통과시킨다 (무한 대기 방지).
      const timer = setTimeout(() => resolve(0), 8000);
      const finish = <T,>(fn: (v: T) => void) => (v: T) => { clearTimeout(timer); fn(v); };
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.onloadedmetadata = () => {
        if (Number.isFinite(video.duration)) return finish(resolve)(video.duration);
        // Browser-recorded (edited) videos report Infinity until seeked to the end.
        video.ondurationchange = () => { if (Number.isFinite(video.duration)) finish(resolve)(video.duration); };
        video.currentTime = 1e7;
      };
      video.onerror = () => finish(reject)(new Error('영상 정보를 읽을 수 없습니다. MP4 또는 MOV 파일을 확인해 주세요.'));
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function validateListingFiles(files: File[]) {
  const photos = files.filter(isListingPhoto);
  const videos = files.filter(isListingVideo);
  if (photos.length > MAX_LISTING_PHOTOS) throw new Error(`사진은 최대 ${MAX_LISTING_PHOTOS}장까지 올릴 수 있어요.`);
  if (videos.length > 1) throw new Error('영상은 상품당 1개만 올릴 수 있어요.');
  if (files.some(file => !isListingPhoto(file) && !isListingVideo(file))) throw new Error('사진은 JPG·PNG·WEBP, 영상은 MP4·MOV·WEBM 형식만 지원해요.');
  if (photos.some(photoTooLarge)) throw new Error('사진은 장당 최대 10MB까지 올릴 수 있어요.');
  const video = videos[0];
  if (video) {
    if (video.size > MAX_VIDEO_BYTES) throw new Error('영상이 300MB를 넘어요. “영상 편집”에서 1분·300MB 이내로 줄인 뒤 올려 주세요.');
    const duration = await readVideoDuration(video);
    if (!Number.isFinite(duration) || duration > MAX_VIDEO_SECONDS + 0.05) throw new Error('영상이 1분을 넘어요. “영상 편집”에서 1분·300MB 이내로 줄인 뒤 올려 주세요.');
  }
}
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** Photo size rule mirrored from the storage bucket: each photo is at most 10MB. */
export const photoTooLarge = (file: { size: number }) => file.size > MAX_PHOTO_BYTES;
