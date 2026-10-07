export const MAX_LISTING_PHOTOS = 10;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 30;

export function isListingVideo(file: File) {
  return file.type === 'video/mp4' || file.type === 'video/quicktime' || file.type === 'video/webm' || /\.(mp4|mov|webm)$/i.test(file.name);
}

export function isListingPhoto(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

export async function readVideoDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('영상 정보를 읽을 수 없습니다. MP4 또는 MOV 파일을 확인해 주세요.'));
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
  const video = videos[0];
  if (video) {
    if (video.size > MAX_VIDEO_BYTES) throw new Error('영상은 최대 200MB까지 올릴 수 있어요.');
    const duration = await readVideoDuration(video);
    if (!Number.isFinite(duration) || duration > MAX_VIDEO_SECONDS + 0.05) throw new Error('영상 길이는 최대 30초까지 가능해요.');
  }
}