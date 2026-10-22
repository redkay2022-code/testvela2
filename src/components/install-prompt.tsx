import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, Share, X } from 'lucide-react';
import { Button } from './ui/button';

/**
 * "Add a VELA shortcut" pop-up.
 *  - Opens automatically when a visitor is taken to the sign-in / sign-up window (unless installed, or snoozed for a day).
 *  - Chrome / Edge / Android: the Install button opens the browser's own install dialog at once and adds the shortcut.
 *  - iPhone, iPad and Mac Safari: short step-by-step instructions (those browsers do not allow a one-click install).
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const DONE_KEY = 'vela-install-done';
const SNOOZE_KEY = 'vela-install-snooze-until';
const OPEN_EVENT = 'vela:offer-install';
const MANUAL_EVENT = 'vela:open-install';
const DAY_MS = 24 * 60 * 60 * 1000;

let deferred: InstallEvent | null = null;

const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

// The browser fires this once, often before React has mounted, so it is captured as soon as this module loads.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; });
  window.addEventListener('appinstalled', () => { deferred = null; write(DONE_KEY, '1'); });
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const snoozed = () => Number(read(SNOOZE_KEY) ?? 0) > Date.now();

/** Automatic offers stay quiet when the app is open as an app, was installed, or the visitor chose "don't show for a day". */
const autoBlocked = () => isStandalone() || snoozed() || (!deferred && read(DONE_KEY) === '1');

/** Called when the sign-in / sign-up window opens. */
export function offerInstallOnAuth() {
  if (typeof window === 'undefined' || autoBlocked()) return;
  window.setTimeout(() => { if (!autoBlocked()) window.dispatchEvent(new Event(OPEN_EVENT)); }, 500);
}

/** Kept for the sign-up flow; the offer is now made when the sign-in window opens. */
export function offerInstall() { /* no-op */ }

type Platform = 'prompt' | 'ios' | 'safari' | 'other' | 'installed';
function detect(): Platform {
  if (deferred) return 'prompt';
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|android/i.test(ua)) return 'safari';
  return read(DONE_KEY) === '1' ? 'installed' : 'other';
}

async function alreadyInstalled() {
  if (isStandalone()) return true;
  try {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    const apps = nav.getInstalledRelatedApps ? await nav.getInstalledRelatedApps() : [];
    return apps.length > 0;
  } catch { return false; }
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');
  const [hideDay, setHideDay] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Shows the browser's own install dialog right away; returns false when this browser needs manual steps. */
  const runInstall = async () => {
    const event = deferred;
    if (!event) return false;
    deferred = null;
    setBusy(true);
    try { await event.prompt(); const choice = await event.userChoice; if (choice.outcome === 'accepted') write(DONE_KEY, '1'); } catch { /* user closed the browser prompt */ }
    setBusy(false);
    return true;
  };
  const runRef = useRef(runInstall); runRef.current = runInstall;

  useEffect(() => {
    // Lets the browser treat VELA as an installable app. The worker only keeps hashed build files and icons; pages and data are always fetched fresh.
    const host = window.location.hostname;
    if (import.meta.env.PROD && 'serviceWorker' in navigator && !/lovableproject\.com$|^id-preview--/.test(host)) {
      const register = () => void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined);
      if (document.readyState === 'complete') register(); else window.addEventListener('load', register, { once: true });
    }
    const show = () => { if (autoBlocked()) return; setHideDay(false); setPlatform(detect()); setOpen(true); };
    /* The "install as an app" menu button: check whether it is installed, then add it to the home screen straight away. */
    const manual = () => {
      void (async () => {
        if (!deferred && await alreadyInstalled()) { setHideDay(false); setPlatform('installed'); setOpen(true); return; }
        if (deferred) { await runRef.current(); setOpen(false); return; }
        setHideDay(false); setPlatform(detect()); setOpen(true);
      })();
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener(MANUAL_EVENT, manual);
    return () => { window.removeEventListener(OPEN_EVENT, show); window.removeEventListener(MANUAL_EVENT, manual); };
  }, []);

  const close = () => { if (hideDay) write(SNOOZE_KEY, String(Date.now() + DAY_MS)); setOpen(false); };
  const install = async () => {
    if (await runInstall()) { setOpen(false); return; }
    setPlatform(detect());
  };

  return <Dialog.Root open={open} onOpenChange={o => { if (!o) close(); }}>
    <Dialog.Portal><Dialog.Overlay className="drawer-backdrop auth-backdrop"/>
      <Dialog.Content className="auth-dialog" aria-describedby={undefined}>
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center">
          <Dialog.Title className="flex items-center gap-2 text-lg font-bold"><Download className="text-primary" size={20}/>Add a VELA shortcut</Dialog.Title>
          <Button variant="ghost" size="icon" type="button" aria-label="Close" onClick={close}><X/></Button>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <img src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-xl"/>
          <p className="text-sm leading-6">Open VELA in one tap from your desktop or home screen, just like an app.</p>
        </div>
        {platform === 'prompt' ? <Button type="button" className="mt-5 w-full" disabled={busy} onClick={() => void install()}><Download/>Install</Button>
          : <p className="mt-5 flex items-start gap-2 rounded-lg border border-dashed border-primary/50 p-3 text-sm leading-6">
            {platform === 'installed' && <><Download className="mt-1 size-4 shrink-0 text-primary"/>VELA is already installed on this device. Open it from your home screen or desktop.</>}
            {platform === 'ios' && <><Share className="mt-1 size-4 shrink-0 text-primary"/>Tap the Share button in Safari, then choose “Add to Home Screen”.</>}
            {platform === 'safari' && <><Share className="mt-1 size-4 shrink-0 text-primary"/>In Safari, choose File → Add to Dock.</>}
            {platform === 'other' && <><Download className="mt-1 size-4 shrink-0 text-primary"/>Open your browser menu and choose “Install VELA” or “Install page as app” (in Chrome: ⋮ → Cast, save, and share → Install page as app).</>}
          </p>}
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="size-5 shrink-0 accent-primary" checked={hideDay} onChange={e => setHideDay(e.target.checked)}/>Don't show again for 1 day</label>
        <Button type="button" variant="ghost" className="mt-2 w-full" onClick={close}>Not now</Button>
      </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

/** 메뉴 안의 '앱처럼 설치' 버튼. 이미 앱으로 열었다면 보이지 않는다. 누르면 설치 여부를 확인한 뒤 바로 홈 화면 추가를 시작한다. */
export function InstallMenuItem() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(!isStandalone()), []);
  if (!show) return null;
  return <section className="border-b border-border py-4"><Button variant="ghost" className="h-auto min-h-11 w-full justify-start gap-3 px-2 py-2 text-start text-sm" onClick={() => window.dispatchEvent(new Event(MANUAL_EVENT))}><Download className="size-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 whitespace-normal leading-5">앱처럼 설치 (홈 화면에 추가)</span></Button></section>;
}
