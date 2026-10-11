import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { attachHls, isHlsUrl } from '@/lib/hls-loader';

/**
 * Feed video that only loads and plays while it is on screen (Intersection Observer).
 *  - Nothing is downloaded until the card is about to enter the viewport (preload="none" + lazy src).
 *  - Only ONE LazyVideo plays at a time: the one most visible on screen. The others pause.
 *  - Videos that scroll far away release their data (src removed) so phones do not run out of memory.
 *  - The poster image is shown (with a small spinner) instead of a black box until the first frame is ready.
 *  - Starts muted; tapping the video toggles sound (shared preference).
 *
 * NOTE: this code only controls loading and playback. It CANNOT compress or re-encode raw video files;
 * compression happens once, in the browser, when the seller uploads (see video-compress.ts), or on a video CDN.
 */
let currentPlayer: { id: number; pause: () => void } | null = null;
let seq = 0;
let soundOn = false;
const NEAR = '60% 0px 60% 0px'; // start loading about half a screen before the video is visible
const FAR = '250% 0px 250% 0px'; // release memory once it is more than ~2 screens away

type Props = { src: string; poster?: string | undefined; className?: string | undefined; label?: string };

function LazyVideoBase({ src, poster, className, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const id = useRef(++seq).current;
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [sound, setSound] = useState(soundOn);
  const ratio = useRef(0);
  const hls = isHlsUrl(src);
  const [visible, setVisible] = useState(false);

  const claim = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (currentPlayer && currentPlayer.id !== id) currentPlayer.pause();
    currentPlayer = { id, pause: () => video.current?.pause() };
    v.muted = !soundOn;
    void v.play().catch(() => { /* autoplay blocked or not loaded yet: the poster simply stays */ });
  }, [id]);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const nearObs = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setNear(true); }, { rootMargin: NEAR });
    const farObs = new IntersectionObserver(([e]) => { if (e && !e.isIntersecting) { setNear(false); setReady(false); } }, { rootMargin: FAR });
    const playObs = new IntersectionObserver(([e]) => {
      const v = video.current;
      ratio.current = e?.intersectionRatio ?? 0;
      setVisible(Boolean(e?.isIntersecting) && ratio.current >= 0.6);
      if (!v) return;
      if (e?.isIntersecting && ratio.current >= 0.6 && !document.hidden) claim();
      else { v.pause(); if (currentPlayer?.id === id) currentPlayer = null; }
    }, { threshold: [0, 0.6, 1] });
    nearObs.observe(el); farObs.observe(el); playObs.observe(el);
    const onVis = () => { const v = video.current; if (!v) return; if (document.hidden) v.pause(); else if (ratio.current >= 0.6) claim(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { nearObs.disconnect(); farObs.disconnect(); playObs.disconnect(); document.removeEventListener('visibilitychange', onVis); if (currentPlayer?.id === id) currentPlayer = null; };
  }, [claim, id]);

  // HLS: the stream exists only while the video is visible; leaving the screen destroys it completely.
  useEffect(() => { const v = video.current; if (!hls || !near || !visible || !v) return; return attachHls(v, src, { onFatal: () => setReady(false) }); }, [hls, near, visible, src]);

  // When the src is dropped (far away) release the decoder and buffers.
  useEffect(() => { const v = video.current; return () => { if (!v) return; v.pause(); v.removeAttribute('src'); v.load(); }; }, []);

  const toggleSound = () => { const next = !soundOn; soundOn = next; setSound(next); const v = video.current; if (v) { v.muted = !next; if (next) void v.play().catch(() => undefined); } };

  return (
    <div ref={box} className="lazy-video" style={{ position: 'relative' }}>
      {poster && <img src={poster} alt="" aria-hidden="true" className={`${className ?? ''} lazy-video-poster`} loading="lazy" style={{ position: 'absolute', inset: 0, opacity: ready ? 0 : 1, transition: 'opacity .2s' }} />}
      {near && <video ref={video} src={hls ? undefined : src} poster={poster} className={className} muted loop playsInline preload="none" aria-label={label} onLoadedData={() => setReady(true)} onPlaying={() => setReady(true)} onClick={toggleSound} style={{ background: '#000' }} />}
      {near && !ready && <span className="shorts-video-loading" aria-label="영상 불러오는 중"><span /></span>}
      {near && <button type="button" className="shorts-sound-toggle" aria-label={sound ? '소리 끄기' : '소리 켜기'} aria-pressed={sound} onClick={toggleSound}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>}
    </div>
  );
}
export const LazyVideo = memo(LazyVideoBase);
