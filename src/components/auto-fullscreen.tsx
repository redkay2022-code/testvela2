import { useEffect } from 'react';

/**
 * Hides the browser's top and bottom bars. Browsers only allow full screen after a tap or click, so it starts on the
 * first touch / click anywhere. Esc (or the system gesture) leaves full screen and it is not forced again in that tab.
 * iPhone Safari has no full-screen API: there, "Add to Home Screen" (see the install pop-up) opens the site without bars.
 */
const STOP_KEY = 'vela-fullscreen-off';
const read = () => { try { return window.sessionStorage.getItem(STOP_KEY); } catch { return null; } };
const write = () => { try { window.sessionStorage.setItem(STOP_KEY, '1'); } catch { /* storage unavailable */ } };

export function AutoFullscreen() {
  useEffect(() => {
    const root = document.documentElement;
    if (typeof root.requestFullscreen !== 'function') return;
    if (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches) return;
    if (read()) return;
    let entered = false;
    const onChange = () => {
      if (document.fullscreenElement) { entered = true; return; }
      if (entered) { write(); cleanup(); }
    };
    const go = () => {
      if (document.fullscreenElement || read()) return;
      void root.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    };
    const cleanup = () => { window.removeEventListener('pointerup', go); document.removeEventListener('fullscreenchange', onChange); };
    window.addEventListener('pointerup', go);
    document.addEventListener('fullscreenchange', onChange);
    return cleanup;
  }, []);
  return null;
}
