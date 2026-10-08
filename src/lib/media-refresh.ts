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
