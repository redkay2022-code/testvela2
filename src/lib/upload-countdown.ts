import { useEffect, useState } from 'react';

/** Rough upload time (seconds): ~1 MB/s plus the real-time video conversion (as long as the clip) when it may be needed. */
export function estimateUploadSeconds(files: { size: number }[], videoSeconds = 0, convert = false) {
  const mb = files.reduce((sum, f) => sum + f.size, 0) / 1_048_576;
  return Math.max(5, Math.ceil(mb) + (convert ? Math.ceil(videoSeconds) : 0) + 4);
}

/** Counts down from `seconds` to 0 while `active`; restarts whenever `seconds` changes. */
export function useCountdown(active: boolean, seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    setLeft(seconds);
    const id = window.setInterval(() => setLeft(Math.max(0, Math.ceil(seconds - (Date.now() - started) / 1000))), 250);
    return () => window.clearInterval(id);
  }, [active, seconds]);
  return left;
}
