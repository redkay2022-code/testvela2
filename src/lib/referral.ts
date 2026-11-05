/** 추천 링크 추적: 방문한 추천 코드(또는 예전 링크의 추천인 ID)를 쿠키 + localStorage 에 7일간 보관한다. */
const KEY = 'vela_ref';
const DAYS = 7;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHORT = /^[A-HJ-NP-Z2-9]{8}$/;
export const isReferralCode = (v: string | null | undefined): v is string => !!v && (UUID.test(v) || SHORT.test(v.toUpperCase()));
/** 8자리 추천 코드인지 (예전 사용자ID 링크·공동구매 ID와 구분하기 위해 짧은 코드만). */
export const isShortReferral = (v: string | null | undefined): v is string => !!v && SHORT.test(v.trim().toUpperCase());
/** 저장·전송용으로 통일: 짧은 코드는 대문자, 예전 ID는 소문자. */
export const normalizeReferral = (v: string) => (UUID.test(v) ? v.toLowerCase() : v.toUpperCase());
export const referralLink = (code: string, origin = typeof window === 'undefined' ? 'https://velamarket.app' : window.location.origin) => `${origin}/ref/${code}`;
export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const telegramShareUrl = (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

export function rememberReferral(code: string) {
  if (typeof window === 'undefined' || !isReferralCode(code)) return;
  const value = normalizeReferral(code);
  try { window.localStorage.setItem(KEY, JSON.stringify({ code: value, exp: Date.now() + DAYS * 86_400_000 })); } catch { /* 저장소 차단 시 쿠키만 사용 */ }
  try { document.cookie = `${KEY}=${value}; max-age=${DAYS * 86_400}; path=/; SameSite=Lax`; } catch { /* ignore */ }
}

export function storedReferral(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as { code?: string; exp?: number };
      if (v.exp && v.exp > Date.now() && isReferralCode(v.code)) return normalizeReferral(v.code);
      window.localStorage.removeItem(KEY);
    }
  } catch { /* ignore */ }
  try {
    const m = document.cookie.split('; ').find(c => c.startsWith(`${KEY}=`))?.slice(KEY.length + 1);
    if (isReferralCode(m)) return normalizeReferral(m);
  } catch { /* ignore */ }
  return null;
}

export function clearReferral() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { document.cookie = `${KEY}=; max-age=0; path=/`; } catch { /* ignore */ }
}
