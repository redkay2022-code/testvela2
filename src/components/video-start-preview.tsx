import { useEffect, useState } from 'react';
import { captureVideoFrame } from '@/lib/video-thumbnail';

/** An opening-frame poster for local upload previews, including edited WEBM clips. */
export function VideoStartPreview({ file, src, className }: { file?: File | undefined; src: string; className: string }) {
  const [poster, setPoster] = useState<string>();
  useEffect(() => {
    let disposed = false;
    let posterUrl: string | undefined;
    setPoster(undefined);
    if (file) void captureVideoFrame(file, 720, 0.05).then(frame => {
      if (disposed || !frame) return;
      posterUrl = URL.createObjectURL(frame);
      setPoster(posterUrl);
    });
    return () => { disposed = true; if (posterUrl) URL.revokeObjectURL(posterUrl); };
  }, [file]);
  return <video src={src} poster={poster} muted playsInline preload="auto" className={className} aria-label="영상 첫 장면" onLoadedData={event => {
    const video = event.currentTarget;
    if (video.currentTime === 0) video.currentTime = 0.05;
  }} />;
}