import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { trackView } from '@/lib/admin-members.functions';

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
  useEffect(() => {
    const path = loc.pathname;
    if (/^\/(admin|seller|seller-store|seller-messages|upload|me)(\/|$)/.test(path)) { prev.current = path; return; }
    const search = (loc.search ?? {}) as Record<string, unknown>;
    const post = /^\/(post|shorts)\/([^/]+)/.exec(path)?.[2] ?? (typeof search['post'] === 'string' && search['post'] ? (search['post'] as string) : typeof search['shorts'] === 'string' && search['shorts'] ? (search['shorts'] as string) : undefined);
    const seller = typeof search['seller'] === 'string' && path.startsWith('/store') ? (search['seller'] as string) : undefined;
    const kind = post ? 'product' : seller ? 'store' : 'page';
    const key = `${kind}:${post ?? seller ?? path}`;
    if (key === last.current) return;
    last.current = key;
    const source = classify(prev.current, typeof search['q'] === 'string' && search['q'] !== '', typeof search['category'] === 'string' && search['category'] !== '');
    prev.current = path;
    const timer = window.setTimeout(() => {
      void track({ data: { visitorId: stored('local', 'vela.vid'), sessionId: stored('session', 'vela.sid'), kind, path: path.slice(0, 200), ...(post ? { postId: decodeURIComponent(post) } : {}), ...(seller ? { sellerKey: seller } : {}), source } }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [loc.pathname, loc.search, track]);
  return null;
}
