import { useEffect, useRef } from 'react';

// Public site key (safe to expose). Can be overridden with VITE_TURNSTILE_SITE_KEY.
const SITE_KEY = (import.meta.env['VITE_TURNSTILE_SITE_KEY'] as string | undefined) || '0x4AAAAAAFcjQ8skV9eInNDM';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC; s.async = true; s.defer = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    s.onerror = () => { scriptPromise = null; s.remove(); reject(new Error('turnstile')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Renders Cloudflare Turnstile. Remount it (change `key`) to get a fresh token. */
export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    cb.current('');
    loadTurnstile().then(api => {
      if (cancelled || !box.current) return;
      id = api.render(box.current, {
        sitekey: SITE_KEY,
        theme: 'dark',
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(''),
        'error-callback': () => cb.current(''),
      });
    }).catch(() => cb.current(''));
    return () => { cancelled = true; if (id && window.turnstile) { try { window.turnstile.remove(id); } catch { /* ignore */ } } };
  }, []);
  return <div ref={box} className="mt-4 flex min-h-[65px] justify-center" data-no-translate />;
}
