import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const SIGNED = '/storage/v1/object/sign/';
let last = 0;

/** When a signed photo/video URL fails (usually expired), refetch data so fresh signed URLs are issued. Throttled to once per 20s. */
export function useMediaRefresh() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const onError = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLSourceElement || el instanceof HTMLAudioElement)) return;
      const src = ('currentSrc' in el ? el.currentSrc : '') || el.getAttribute('src') || '';
      if (!src.includes(SIGNED) || Date.now() - last < 20_000) return;
      last = Date.now();
      void queryClient.invalidateQueries();
    };
    // Media errors don't bubble; listen in the capture phase.
    window.addEventListener('error', onError, true);
    const onVisible = () => { if (document.visibilityState === 'visible') void queryClient.invalidateQueries({ queryKey: ['posts'], refetchType: 'active' }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('error', onError, true); document.removeEventListener('visibilitychange', onVisible); };
  }, [queryClient]);
}

/** Keeps the same signed URL while the underlying file is unchanged, so a data refetch (new token) doesn't restart a playing video. Swaps only after a media error. */
const stableCache = new Map<string, string>();
export function stableMediaSrc(url: string | undefined | null, refresh = false) {
  if (!url) return url ?? undefined;
  const key = url.split('?')[0]!;
  const prev = stableCache.get(key);
  if (prev && !refresh) return prev;
  stableCache.set(key, url);
  return url;
}
