/** 추천 링크 추적: 방문한 추천인 ID를 쿠키 + localStorage 에 30일간 보관한다. */
const KEY = 'vela_ref';
const DAYS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isReferralCode = (v: string | null | undefined): v is string => !!v && UUID.test(v);
export const referralLink = (userId: string, origin = typeof window === 'undefined' ? 'https://velamarket.app' : window.location.origin) => `${origin}/ref/${userId}`;
export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function rememberReferral(code: string) {
  if (typeof window === 'undefined' || !isReferralCode(code)) return;
  const value = code.toLowerCase();
  try { window.localStorage.setItem(KEY, JSON.stringify({ code: value, exp: Date.now() + DAYS * 86_400_000 })); } catch { /* 저장소 차단 시 쿠키만 사용 */ }
  try { document.cookie = `${KEY}=${value}; max-age=${DAYS * 86_400}; path=/; SameSite=Lax`; } catch { /* ignore */ }
}

export function storedReferral(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as { code?: string; exp?: number };
      if (v.exp && v.exp > Date.now() && isReferralCode(v.code)) return v.code;
      window.localStorage.removeItem(KEY);
    }
  } catch { /* ignore */ }
  try {
    const m = document.cookie.split('; ').find(c => c.startsWith(`${KEY}=`))?.slice(KEY.length + 1);
    if (isReferralCode(m)) return m;
  } catch { /* ignore */ }
  return null;
}

export function clearReferral() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { document.cookie = `${KEY}=; max-age=0; path=/`; } catch { /* ignore */ }
}
