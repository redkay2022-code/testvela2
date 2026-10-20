import { translateTexts } from './translate.functions';

/**
 * 사용자가 쓴 글(댓글·리뷰·문의·공지·스토어 소개·메시지)을 화면에 보이는 즉시 한꺼번에 번역하기 위한 대기열.
 * 같은 순간에 필요한 글을 언어별로 모아 한 번에 요청하고, 번역한 글은 이 기기에 저장해 다음에는 바로 보여 준다.
 */
type Waiter = (value: string) => void;
const waiting = new Map<string, Map<string, Waiter[]>>(); // lang -> text -> waiters
const memory = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const STORE = 'vela.tr.v1', MAX_SAVED = 300;

const read = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, string>; } catch { return {}; } };
const keyOf = (lang: string, text: string) => `${lang}\u0000${text}`;
export function cachedTranslation(lang: string, text: string): string | null {
  const k = keyOf(lang, text);
  if (memory.has(k)) return memory.get(k)!;
  const saved = read()[k];
  if (saved) { memory.set(k, saved); return saved; }
  return null;
}
function remember(lang: string, text: string, value: string) {
  const k = keyOf(lang, text); memory.set(k, value);
  try { const all = read(); all[k] = value; const keys = Object.keys(all); if (keys.length > MAX_SAVED) for (const old of keys.slice(0, keys.length - MAX_SAVED)) delete all[old]; localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* 저장 공간이 없어도 번역은 계속 보인다 */ }
}

async function flush() {
  timer = null;
  const jobs = [...waiting]; waiting.clear();
  for (const [lang, texts] of jobs) {
    const list = [...texts.keys()];
    for (let i = 0; i < list.length; i += 10) {
      const chunk = list.slice(i, i + 10);
      void translateTexts({ data: { lang, texts: chunk } })
        .then(out => chunk.forEach((t, k) => { const v = out[k] ?? t; if (v.trim() !== t.trim()) remember(lang, t, v); /* 실패해서 원문이 돌아온 경우는 저장하지 않아 다음에 다시 시도한다 */ texts.get(t)?.forEach(w => w(v)); }))
        .catch(() => chunk.forEach(t => texts.get(t)?.forEach(w => w(t))));
    }
  }
}

/** 번역을 요청한다(실패하면 원문을 돌려준다). */
export function queueTranslation(lang: string, text: string): Promise<string> {
  const hit = cachedTranslation(lang, text);
  if (hit) return Promise.resolve(hit);
  return new Promise(resolve => {
    const byText = waiting.get(lang) ?? new Map<string, Waiter[]>(); waiting.set(lang, byText);
    byText.set(text, [...(byText.get(text) ?? []), resolve]);
    if (!timer) timer = setTimeout(() => void flush(), 30);
  });
}
