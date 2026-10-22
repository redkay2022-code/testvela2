import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, Share, X } from 'lucide-react';
import { Button } from './ui/button';

/**
 * "Add a VELA shortcut" pop-up shown right after a new member signs up.
 *  - Chrome / Edge / Android: one button opens the browser's own install dialog (creates a desktop / home-screen shortcut).
 *  - iPhone, iPad and Mac Safari: short step-by-step instructions (those browsers do not allow a one-click install).
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const OFFER_KEY = 'vela-install-offer';
const DISMISS_KEY = 'vela-install-dismissed';
const OPEN_EVENT = 'vela:offer-install';
const MANUAL_EVENT = 'vela:open-install';

let deferred: InstallEvent | null = null;

const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const clear = (k: string) => { try { window.localStorage.removeItem(k); } catch { /* storage unavailable */ } };

// The browser fires this once, often before React has mounted, so it is captured as soon as this module loads.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; });
  window.addEventListener('appinstalled', () => { deferred = null; write(DISMISS_KEY, '1'); });
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Call right after a successful sign-up. */
export function offerInstall() {
  if (typeof window === 'undefined' || isStandalone() || read(DISMISS_KEY)) return;
  write(OFFER_KEY, '1');
  window.setTimeout(() => window.dispatchEvent(new Event(OPEN_EVENT)), 700);
}

type Platform = 'prompt' | 'ios' | 'safari' | 'other';
function detect(): Platform {
  if (deferred) return 'prompt';
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|android/i.test(ua)) return 'safari';
  return 'other';
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');

  useEffect(() => {
    // Lets the browser treat VELA as an installable app. The worker only keeps hashed build files and icons; pages and data are always fetched fresh.
    const host = window.location.hostname;
    if (import.meta.env.PROD && 'serviceWorker' in navigator && !/lovableproject\.com$|^id-preview--/.test(host)) {
      const register = () => void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined);
      if (document.readyState === 'complete') register(); else window.addEventListener('load', register, { once: true });
    }
    const show = () => { if (isStandalone() || read(DISMISS_KEY)) return; setPlatform(detect()); setOpen(true); };
    if (read(OFFER_KEY)) window.setTimeout(show, 1200);
    const manual = () => { if (isStandalone()) return; setPlatform(detect()); setOpen(true); };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener(MANUAL_EVENT, manual);
    return () => { window.removeEventListener(OPEN_EVENT, show); window.removeEventListener(MANUAL_EVENT, manual); };
  }, []);

  const close = (never = false) => { clear(OFFER_KEY); if (never) write(DISMISS_KEY, '1'); setOpen(false); };
  const install = async () => {
    const event = deferred;
    if (!event) { setPlatform(detect()); return; }
    deferred = null;
    try { await event.prompt(); const choice = await event.userChoice; if (choice.outcome === 'accepted') write(DISMISS_KEY, '1'); } catch { /* user closed the browser prompt */ }
    close();
  };

  return <Dialog.Root open={open} onOpenChange={o => { if (!o) close(); }}>
    <Dialog.Portal><Dialog.Overlay className="drawer-backdrop auth-backdrop"/>
      <Dialog.Content className="auth-dialog" aria-describedby={undefined}>
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center">
          <Dialog.Title className="flex items-center gap-2 text-lg font-bold"><Download className="text-primary" size={20}/>Add a VELA shortcut</Dialog.Title>
          <Button variant="ghost" size="icon" type="button" aria-label="Close" onClick={() => close()}><X/></Button>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <img src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-xl"/>
          <p className="text-sm leading-6">Open VELA in one tap from your desktop or home screen, just like an app.</p>
        </div>
        {platform === 'prompt' ? <Button type="button" className="mt-5 w-full" onClick={() => void install()}><Download/>Add shortcut</Button>
          : <p className="mt-5 flex items-start gap-2 rounded-lg border border-dashed border-primary/50 p-3 text-sm leading-6">
            {platform === 'ios' && <><Share className="mt-1 size-4 shrink-0 text-primary"/>Tap the Share button in Safari, then choose “Add to Home Screen”.</>}
            {platform === 'safari' && <><Share className="mt-1 size-4 shrink-0 text-primary"/>In Safari, choose File → Add to Dock.</>}
            {platform === 'other' && <><Download className="mt-1 size-4 shrink-0 text-primary"/>Open your browser menu and choose “Install VELA” or “Install page as app” (in Chrome: ⋮ → Cast, save, and share → Install page as app).</>}
          </p>}
        <div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" variant="ghost" onClick={() => close()}>Not now</Button><Button type="button" variant="ghost" onClick={() => close(true)}>Don't show again</Button></div>
      </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

/** 메뉴 안의 '앱처럼 설치' 버튼. 이미 앱으로 열었다면 보이지 않는다. 예전에 '다시 보지 않기'를 눌렀어도 직접 누르면 안내가 열린다. */
export function InstallMenuItem() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(!isStandalone()), []);
  if (!show) return null;
  return <section className="border-b border-border py-4"><Button variant="ghost" className="h-auto min-h-11 w-full justify-start gap-3 px-2 py-2 text-start text-sm" onClick={() => window.dispatchEvent(new Event(MANUAL_EVENT))}><Download className="size-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 whitespace-normal leading-5">앱처럼 설치 (홈 화면에 추가)</span></Button></section>;
}
