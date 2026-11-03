/** 공동구매(즉시 가격 할인, 포인트 적립 없음): 링크 추적(7일), 할인율표, 남은 시간 계산. 할인율표는 DB 함수 _group_discount_pct 와 같은 값이다. */
const KEY = 'vela_group';
const DAYS = 7;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GROUP_MIN_SIZE = 2;
export const GROUP_MAX_SIZE = 10;
export const GROUP_MIN_HOURS = 1;
export const GROUP_MAX_HOURS = 72;
export const GROUP_DEFAULT_HOURS = 72;
export const GROUP_HOUR_PRESETS = [6, 12, 24, 48, 72] as const;

export const isGroupId = (v: string | null | undefined): v is string => !!v && UUID.test(v);
export const groupLink = (id: string, origin = typeof window === 'undefined' ? 'https://velamarket.app' : window.location.origin) => `${origin}/group/${id}`;

/** 인원수 → 즉시 할인율(%): 2~3명 5 / 4~6명 8 / 7~9명 12 / 10명 15 */
export function groupDiscountPct(members: number): number {
  const n = Math.floor(members);
  if (n >= 10) return 15;
  if (n >= 7) return 12;
  if (n >= 4) return 8;
  if (n >= 2) return 5;
  return 0;
}
export const groupDiscountUsd = (productUsd: number, pct: number) => Math.round(productUsd * pct) / 100;

export const clampGroupSize = (n: number) => Math.min(GROUP_MAX_SIZE, Math.max(GROUP_MIN_SIZE, Math.floor(Number.isFinite(n) ? n : GROUP_MIN_SIZE)));
export const clampGroupHours = (n: number) => Math.min(GROUP_MAX_HOURS, Math.max(GROUP_MIN_HOURS, Math.floor(Number.isFinite(n) ? n : GROUP_DEFAULT_HOURS)));

/** 남은 시간을 "1일 3시간" / "5시간 20분" / "12분" 형태의 값으로 나눈다. */
export function timeLeft(expiresAt: string | number | Date, now = Date.now()): { total: number; days: number; hours: number; minutes: number } {
  const total = Math.max(0, new Date(expiresAt).getTime() - now);
  const mins = Math.floor(total / 60_000);
  return { total, days: Math.floor(mins / 1440), hours: Math.floor((mins % 1440) / 60), minutes: mins % 60 };
}

export function rememberGroup(id: string) {
  if (typeof window === 'undefined' || !isGroupId(id)) return;
  const value = id.toLowerCase();
  try { window.localStorage.setItem(KEY, JSON.stringify({ id: value, exp: Date.now() + DAYS * 86_400_000 })); } catch { /* 저장소 차단 시 쿠키만 사용 */ }
  try { document.cookie = `${KEY}=${value}; max-age=${DAYS * 86_400}; path=/; SameSite=Lax`; } catch { /* ignore */ }
}

export function storedGroup(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as { id?: string; exp?: number };
      if (v.exp && v.exp > Date.now() && isGroupId(v.id)) return v.id;
      window.localStorage.removeItem(KEY);
    }
  } catch { /* ignore */ }
  try {
    const m = document.cookie.split('; ').find(c => c.startsWith(`${KEY}=`))?.slice(KEY.length + 1);
    if (isGroupId(m)) return m;
  } catch { /* ignore */ }
  return null;
}

export function clearGroup() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { document.cookie = `${KEY}=; max-age=0; path=/`; } catch { /* ignore */ }
}
