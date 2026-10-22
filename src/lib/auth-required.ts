/** 로그인하지 않은 방문자가 팔로우·저장·좋아요를 누르면 로그인/회원가입 창을 열도록 알리는 신호. */
export const AUTH_REQUIRED_EVENT = 'vela:auth-required';
export const requestLogin = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT)); };
