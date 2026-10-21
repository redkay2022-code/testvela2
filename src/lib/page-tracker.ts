import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { activeLang } from './i18n';

/** 방문 통계용 기록기: 임의 방문자 ID·접속 경로·기기·언어·검색어만 저장합니다(이름·연락처·IP 저장 안 함). */
function visitorId(): string | null {
  try {
    let id = window.localStorage.getItem('vela.vid');
    if (!id || id.length < 8) { id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; window.localStorage.setItem('vela.vid', id); }
    return id;
  } catch { return null; }
}
const deviceOf = () => { const w = window.innerWidth; return w < 768 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop'; };
function externalReferrer(): string | null {
  try {
    if (window.sessionStorage.getItem('vela.ref-sent')) return null;
    window.sessionStorage.setItem('vela.ref-sent', '1');
    const ref = document.referrer; if (!ref) return null;
    return new URL(ref).hostname === window.location.hostname ? null : ref;
  } catch { return null; }
}
function send(kind: 'view' | 'search', path: string, term: string | null, referrer: string | null) {
  const vid = visitorId(); if (!vid) return;
  try {
    const call = (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<unknown> }).rpc('track_page_view', { _session: vid, _kind: kind, _path: path, _referrer: referrer, _device: deviceOf(), _lang: activeLang(), _term: term });
    void Promise.resolve(call).then(() => undefined, () => undefined);
  } catch { /* 통계 기록 실패가 화면에 영향을 주면 안 됩니다 */ }
}

export function usePageTracker() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const q = useRouterState({ select: s => (s.location.search as { q?: unknown } | undefined)?.q });
  const lastPath = useRef<string | null>(null), lastTerm = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || pathname.startsWith('/admin') || pathname.startsWith('/api')) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    send('view', pathname, null, externalReferrer());
  }, [pathname]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const term = typeof q === 'string' ? q.trim() : '';
    if (!term || term === lastTerm.current) return;
    lastTerm.current = term;
    send('search', pathname, term, null);
  }, [q, pathname]);
}
