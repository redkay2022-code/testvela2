import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Button } from './ui/button';
import { tx } from '@/lib/dom-translate';

/** 로그인 전(비회원) 첫 홈 화면에서 아래로 내려볼 수 있는 최대 길이: 화면 높이의 5배(= 스크롤 5번). */
export const GUEST_MAX_SCREENS = 5;

/**
 * 비회원은 홈 피드를 화면 5개 분량까지만 볼 수 있다. 그보다 아래는 가려지고(추가 상품도 불러오지 않음)
 * 가입/로그인 안내가 나온다. 회원(active=false)이면 아무것도 바꾸지 않고 내용을 그대로 보여준다.
 */
export function GuestScrollLimit({ active, onSignup, children }: { active: boolean; onSignup: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!active || !el) { setClipped(false); return; }
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 2);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    Array.from(el.children).forEach(c => ro.observe(c));
    return () => ro.disconnect();
  }, [active]);
  // 회원/비회원 전환 시 화면이 다시 만들어지며 깜빡이지 않도록 항상 같은 구조를 유지한다.
  return <>
    <div ref={box} style={active ? { maxHeight: `calc(${GUEST_MAX_SCREENS} * 100dvh)`, overflow: 'hidden', position: 'relative' } : undefined}>
      {children}
      {active && clipped && <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, pointerEvents: 'none', background: 'linear-gradient(to bottom, transparent, var(--background))' }} />}
    </div>
    {active && clipped && <section className="mx-auto my-6 max-w-md rounded-lg border border-primary/40 bg-card p-5 text-center" aria-label={tx('회원가입 / 로그인')}>
      <Lock className="mx-auto mb-2 text-primary" size={22} aria-hidden />
      <p className="text-sm font-semibold">{tx('가입하거나 로그인하면 더 많은 상품을 볼 수 있어요.')}</p>
      <Button type="button" variant="gold" className="mt-4 w-full" onClick={onSignup}>{tx('회원가입 / 로그인')}</Button>
    </section>}
  </>;
}
