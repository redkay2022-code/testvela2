import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const names: Record<string, string> = { en: 'English', ko: 'Korean', zh: 'Simplified Chinese', ja: 'Japanese', it: 'Italian', fr: 'French', de: 'German', nl: 'Dutch', ru: 'Russian', la: 'Latin', ar: 'Arabic' };
const cache = new Map<string, string>();

/** Machine-translates user/seller-written snippets into the target language; returns originals on failure. */
export const translateTexts = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ lang: z.enum(Object.keys(names) as [string, ...string[]]), texts: z.array(z.string().min(1).max(600)).min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const out: string[] = data.texts.map((t) => cache.get(`${data.lang}\u0000${t}`) ?? '');
    const todo = data.texts.map((t, i) => ({ t, i })).filter(({ i }) => !out[i]);
    if (todo.length) {
      try {
        const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env['LOVABLE_API_KEY']}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: `Translate each string of a luxury watch marketplace into ${names[data.lang]}. Keep brand names, model codes, numbers, prices, emoji and hashtags' meaning. If a string is already in ${names[data.lang]}, return it unchanged. Reply as JSON {"t":[...]} with the same count and order.` },
              { role: 'user', content: JSON.stringify(todo.map((x) => x.t)) },
            ],
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '{}') as { t?: unknown };
          if (Array.isArray(parsed.t) && parsed.t.length === todo.length) {
            todo.forEach(({ t, i }, k) => { const v = parsed.t as unknown[]; const s = typeof v[k] === 'string' ? (v[k] as string) : t; out[i] = s; cache.set(`${data.lang}\u0000${t}`, s); });
          }
        }
      } catch { /* fall back to originals */ }
    }
    return data.texts.map((t, i) => out[i] || t);
  });
