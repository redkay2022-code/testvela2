import { isListingPhoto, isListingVideo, MAX_LISTING_PHOTOS, photoTooLarge, readVideoDuration } from '@/lib/listing-media';
import { tx } from '@/lib/dom-translate';
import { LOUNGE_MAX_BYTES, loungeTooLong } from '@/lib/lounge';

/** Checks the files picked for a Story post: up to 9 photos (10MB each) and at most one video (max 5 minutes, 300MB). */
export async function validateLoungeFiles(files: File[]): Promise<void> {
  if (files.some(f => !isListingPhoto(f) && !isListingVideo(f))) throw new Error(tx('사진은 JPG·PNG·WEBP, 영상은 MP4·MOV·WEBM 형식만 지원해요.'));
  if (files.filter(isListingPhoto).length > MAX_LISTING_PHOTOS) throw new Error(tx('사진은 최대 {0}장까지 올릴 수 있어요.', { 0: MAX_LISTING_PHOTOS }));
  if (files.filter(isListingPhoto).some(photoTooLarge)) throw new Error(tx('사진은 장당 최대 10MB까지 올릴 수 있어요.'));
  const videos = files.filter(isListingVideo), video = videos[0];
  if (videos.length > 1) throw new Error(tx('영상은 상품당 1개만 올릴 수 있어요.'));
  if (!video) return;
  if (video.size > LOUNGE_MAX_BYTES) throw new Error(tx('영상이 300MB를 넘어요. 용량을 줄여 주세요.'));
  if (loungeTooLong(await readVideoDuration(video))) throw new Error(tx('스토리 영상은 5분 이내만 올릴 수 있어요.'));
}
