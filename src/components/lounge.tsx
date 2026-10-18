import { isListingPhoto, isListingVideo, readVideoDuration } from '@/lib/listing-media';
import { tx } from '@/lib/dom-translate';
import { LOUNGE_MAX_BYTES, loungeTooLong } from '@/lib/lounge';

/** Checks the files picked for a Story post: exactly one video (max 5 minutes, 300MB) and no photos. */
export async function validateLoungeFiles(files: File[]): Promise<void> {
  if (files.some(f => !isListingPhoto(f) && !isListingVideo(f))) throw new Error(tx('MP4, MOV, WEBM 영상만 올릴 수 있어요.'));
  if (files.some(isListingPhoto)) throw new Error(tx('스토리에는 영상만 올릴 수 있어요. 사진은 빼 주세요.'));
  const videos = files.filter(isListingVideo), video = videos[0];
  if (videos.length !== 1 || !video) throw new Error(tx('스토리 영상 1개를 선택해 주세요.'));
  if (video.size > LOUNGE_MAX_BYTES) throw new Error(tx('영상이 300MB를 넘어요. 용량을 줄여 주세요.'));
  if (loungeTooLong(await readVideoDuration(video))) throw new Error(tx('스토리 영상은 5분 이내만 올릴 수 있어요.'));
}

