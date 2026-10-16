import { useCallback, useRef, useState } from 'react';

/**
 * 화면(컴포넌트)이 사라졌다가 다시 열려도 작성 중인 내용을 되살리기 위한 메모리 저장소.
 * 앱 안에서 다른 페이지로 갔다가 돌아올 때는 그대로 복원되고, 새로고침·탭 닫기·로그아웃이면 비워진다.
 * (사진·영상 파일은 직렬화할 수 없어서 브라우저 저장소가 아니라 메모리에만 둔다.)
 */
const store = new Map<string, unknown>();

/** 만든 미리보기 주소(blob:)를 모아 두었다가 작성이 끝나면 한 번에 해제한다. */
export class UrlBag {
  private urls = new Set<string>();
  add(url: string) { this.urls.add(url); return url; }
  drop(url: string) { if (this.urls.delete(url)) URL.revokeObjectURL(url); }
  revokeAll() { this.urls.forEach(u => URL.revokeObjectURL(u)); this.urls.clear(); }
}

export const sessionGet = <T,>(key: string): T | undefined => store.get(key) as T | undefined;
export const sessionHas = (key: string) => store.has(key) && store.get(key) != null;
export const sessionBag = (key: string): UrlBag => { const hit = store.get(key); if (hit instanceof UrlBag) return hit; const bag = new UrlBag(); store.set(key, bag); return bag; };

/** prefix 로 시작하는 항목을 모두 지운다. 빈 문자열이면 전부 지운다. */
export function clearSession(prefix: string) {
  for (const [key, value] of [...store.entries()]) {
    if (!key.startsWith(prefix)) continue;
    if (value instanceof UrlBag) value.revokeAll();
    store.delete(key);
  }
}

/** useState 와 같지만 값이 key 로 저장소에 함께 기록돼, 컴포넌트를 다시 열면 마지막 값으로 시작한다. */
export function useSessionState<T>(key: string, init: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : init instanceof Function ? init() : init));
  const latest = useRef(value);
  latest.current = value;
  const set = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = next instanceof Function ? next(latest.current) : next;
    latest.current = resolved;
    store.set(key, resolved);
    setValue(resolved);
  }, [key]);
  return [value, set];
}
