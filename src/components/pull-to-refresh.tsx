import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, ArrowDown } from 'lucide-react';
import { refreshPullDistance, shouldRefreshPull } from '@/lib/pull-refresh';

/** Handles both document scrolling and nested product/panel scroll containers. */
export function PullToRefresh({ disabled = false, onError }: { disabled?: boolean; onError: (message: string) => void }) {
  const client = useQueryClient();
  const [distance, setDistance] = useState(0), [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    if (disabled) return;
    let start: { x: number; y: number } | undefined, pull = 0;
    const reset = () => { start = undefined; pull = 0; setDistance(0); };
    const begin = (event: TouchEvent) => {
      if (busy.current || event.touches.length !== 1 || !(event.target instanceof Element)) return;
      if (event.target.closest('input,textarea,select,video,[role="slider"]')) return;
      let node: Element | null = event.target;
      let nestedScroller = false;
      while (node && node !== document.documentElement) {
        if (/auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
          if (node.scrollTop > 0) return;
          nestedScroller = true;
        }
        node = node.parentElement;
      }
      if (!nestedScroller && window.scrollY > 0) return;
      const touch = event.touches[0];
      if (touch) start = { x: touch.clientX, y: touch.clientY };
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      if (event.touches.length !== 1) { reset(); return; }
      const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
      if (dy < -8 || Math.abs(dx) > Math.max(12, dy)) { reset(); return; }
      pull = refreshPullDistance(dx, dy);
      if (pull > 0 && event.cancelable) event.preventDefault();
      setDistance(pull);
    };
    const end = () => {
      const trigger = shouldRefreshPull(pull);
      reset();
      if (!trigger || busy.current) return;
      busy.current = true; setRefreshing(true);
      void client.invalidateQueries({ refetchType: 'active' }, { throwOnError: true })
        .catch(() => onError('새로고침하지 못했습니다. 잠시 후 다시 시도해 주세요.'))
        .finally(() => { busy.current = false; setRefreshing(false); });
    };
    document.addEventListener('touchstart', begin, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', reset);
    return () => {
      document.removeEventListener('touchstart', begin); document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', reset);
    };
  }, [client, disabled, onError]);
  return (refreshing || distance > 0) ? <div className="lux-pull-refresh" role="status" aria-label={refreshing ? '최신 데이터 새로고침 중' : shouldRefreshPull(distance) ? '놓으면 새로고침' : '당겨서 새로고침'}>
    {refreshing ? <LoaderCircle className="animate-spin"/> : <ArrowDown className={shouldRefreshPull(distance) ? 'rotate-180' : ''}/>}<span className="sr-only">{refreshing ? '최신 데이터 새로고침 중' : '당겨서 새로고침'}</span>
  </div> : null;
}