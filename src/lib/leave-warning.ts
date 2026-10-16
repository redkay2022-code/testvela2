import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from '@tanstack/react-router';

export const LEAVE_WARNING_MESSAGE = '작성 중인 내용이 사라질 수 있어요.\n이 페이지에서 나갈까요?\n\n[취소]를 누르면 계속 작성할 수 있어요.';

/**
 * 상품 올리기·수정 중에 뒤로가기(스와이프·브라우저 뒤로 버튼), 다른 메뉴 이동, 새로고침·탭 닫기를 실수로 눌렀을 때
 * 확인 팝업을 띄운다. active=false 이면 아무것도 하지 않는다.
 * keepOnNavigate=true 이면 작성 내용이 앱 안에서 보관되므로(session-state) 앱 안 이동은 그냥 허용하고,
 * 새로고침·탭 닫기(내용이 사라지는 경우)에만 경고한다.
 * 저장이 끝나 일부러 화면을 떠날 때는 반환된 release() 를 먼저 호출해 경고를 끈다.
 */
export function useLeaveWarning(active: boolean, options?: { keepOnNavigate?: boolean }) {
  const released = useRef(false);
  const keep = options?.keepOnNavigate ?? false;
  useBlocker({
    shouldBlockFn: () => {
      if (released.current || !active) return false;
      return !window.confirm(LEAVE_WARNING_MESSAGE);
    },
    enableBeforeUnload: () => active && !released.current,
    disabled: !active || keep,
  });
  useEffect(() => {
    if (!keep || !active) return;
    const onUnload = (event: BeforeUnloadEvent) => { if (released.current) return; event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [keep, active]);
  return useCallback(() => { released.current = true; }, []);
}
