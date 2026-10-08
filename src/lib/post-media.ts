import type { LuxuryPost } from './luxury-market';

/** Generated video posters are not uploaded photos. */
export function postPhotos(post: LuxuryPost): string[] {
  return post.sample ? post.images : post.source.media_urls.length ? post.images : post.video ? [] : post.images;
}

export function postMediaRoute(post: LuxuryPost): '/shorts/$id' | '/post/$id' {
  return post.video && postPhotos(post).length === 0 ? '/shorts/$id' : '/post/$id';
}

export function detailMedia(post: LuxuryPost) {
  return [
    ...(post.video ? [{ kind: 'video' as const, src: post.video }] : []),
    ...postPhotos(post).map(src => ({ kind: 'photo' as const, src })),
  ];
}