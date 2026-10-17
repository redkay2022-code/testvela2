import { useCallback, useEffect, useRef, type ComponentPropsWithoutRef, type Ref } from 'react';
import { attachHls, isHlsUrl } from '@/lib/hls-loader';

type Props = Omit<ComponentPropsWithoutRef<'video'>, 'src'> & { src: string; ref?: Ref<HTMLVideoElement> };

/**
 * A <video> that also plays HLS (.m3u8, e.g. Mux) URLs everywhere.
 * Safari/iOS play HLS natively; other browsers use hls.js (loaded on demand). Plain MP4 URLs behave exactly like <video src>.
 */
export function StreamVideo({ src, ref, ...rest }: Props) {
  const own = useRef<HTMLVideoElement | null>(null);
  const hls = isHlsUrl(src);
  const setRef = useCallback((el: HTMLVideoElement | null) => {
    own.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as { current: HTMLVideoElement | null }).current = el;
  }, [ref]);
  useEffect(() => {
    const v = own.current;
    if (!hls || !v) return;
    return attachHls(v, src);
  }, [hls, src]);
  return <video ref={setRef} src={hls ? undefined : src} {...rest} />;
}
