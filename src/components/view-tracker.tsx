import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { trackView } from '@/lib/admin-members.functions';
import { addDwell, recordOpen } from '@/lib/seen-history';

/**
 * First-party visit counter used for the seller and admin analytics.
 * Stores only random ids kept in the visitor's own browser; no IP address, name or phone number is recorded.
 */
const rid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
function stored(storage: 'local' | 'session', key: string) {
  try { const s = storage === 'local' ? localStorage : sessionStorage; let v = s.getItem(key); if (!v) { v = rid(); s.setItem(key, v); } return v; } catch { return rid(); }
}
const EXTERNAL: [RegExp, string][] = [[/instagram\./, 'instagram'], [/(^|\.)t\.me$|telegram/, 'telegram'], [/facebook\.|fb\.com/, 'facebook'], [/twitter\.|(^|\.)x\.com$/, 'x'], [/google\./, 'google'], [/youtube\.|youtu\.be/, 'youtube'], [/wechat|weixin|qq\.com/, 'wechat'], [/naver\./, 'naver'], [/bing\./, 'bing']];

function classify(prevPath: string, hasQuery: boolean, hasCategory: boolean): string {
  if (!prevPath) {
    const ref = (typeof document !== 'undefined' ? document.referrer : '') || '';
    let host = ''; try { host = ref ? new URL(ref).hostname : ''; } catch { host = ''; }
    if (!host || host === (typeof location !== 'undefined' ? location.hostname : '')) return 'direct';
    return EXTERNAL.find(([re]) => re.test(host))?.[1] ?? 'external';
  }
  if (hasQuery) return 'search';
  if (hasCategory) return 'category';
  if (prevPath.startsWith('/shorts')) return 'shorts';
  if (prevPath === '/' || prevPath.startsWith('/explore')) return 'feed';
  if (prevPath.startsWith('/store') || prevPath.startsWith('/seller-store')) return 'store';
  return 'internal';
}

export function ViewTracker() {
  const track = useServerFn(trackView);
  const loc = useRouterState({ select: s => s.location });
  const prev = useRef('');
  const last = useRef('');
  // Which product the visitor is looking at and since when (at = 0 while the tab is hidden). Stays on this device only.
  const dwell = useRef<{ id: string; at: number } | null>(null);
  const endDwell = () => { const d = dwell.current; dwell.current = null; if (d && d.at) addDwell(d.id, Date.now() - d.at); };
  useEffect(() => {
    const onVisibility = () => {
      const d = dwell.current; if (!d) return;
      if (document.hidden) { if (d.at) { addDwell(d.id, Date.now() - d.at); d.at = 0; } } else if (!d.at) d.at = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', endDwell);
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', endDwell); endDwell(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const path = loc.pathname;
    if (/^\/(admin|seller|seller-store|seller-messages|upload|me)(\/|$)/.test(path)) { endDwell(); prev.current = path; return; }
    const search = (loc.search ?? {}) as Record<string, unknown>;
    const post = /^\/(post|shorts)\/([^/]+)/.exec(path)?.[2] ?? (typeof search['post'] === 'string' && search['post'] ? (search['post'] as string) : typeof search['shorts'] === 'string' && search['shorts'] ? (search['shorts'] as string) : undefined);
    const seller = typeof search['seller'] === 'string' && path.startsWith('/store') ? (search['seller'] as string) : undefined;
    const kind = post ? 'product' : seller ? 'store' : 'page';
    const key = `${kind}:${post ?? seller ?? path}`;
    if (key === last.current) return;
    last.current = key;
    endDwell();
    if (post) { let id = post; try { id = decodeURIComponent(post); } catch { /* keep raw id */ } recordOpen(id); dwell.current = { id, at: Date.now() }; }
    const source = classify(prev.current, typeof search['q'] === 'string' && search['q'] !== '', typeof search['category'] === 'string' && search['category'] !== '');
    prev.current = path;
    const timer = window.setTimeout(() => {
      void track({ data: { visitorId: stored('local', 'vela.vid'), sessionId: stored('session', 'vela.sid'), kind, path: path.slice(0, 200), ...(post ? { postId: decodeURIComponent(post) } : {}), ...(seller ? { sellerKey: seller } : {}), source } }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [loc.pathname, loc.search, track]);
  return null;
}
