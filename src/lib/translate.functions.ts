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
        const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
          method: 'POST',
          headers: { 'Lovable-API-Key': process.env['LOVABLE_API_KEY'] ?? '', 'X-Lovable-AIG-SDK': 'fetch', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'openai/gpt-6-astra',
            stream: true,
            store: false,
            reasoning: { effort: 'low' },
            text: { format: { type: 'json_schema', name: 'translations', strict: true, schema: { type: 'object', additionalProperties: false, required: ['t'], properties: { t: { type: 'array', items: { type: 'string' } } } } } },
            input: [
              { role: 'system', content: `Translate each string of a luxury watch marketplace into ${names[data.lang]}. Keep brand names, model codes, numbers and prices. If a string is already in ${names[data.lang]}, return it unchanged. Return the same count and order. Keep output brief.` },
              { role: 'user', content: JSON.stringify(todo.map((x) => x.t)) },
            ],
          }),
        });
        if (res.ok && res.body) {
          const reader = res.body.getReader(), dec = new TextDecoder();
          let buf = '', text = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n'); buf = lines.pop() ?? '';
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              try { const ev = JSON.parse(line.slice(5)) as { type?: string; delta?: string }; if (ev.type === 'response.output_text.delta' && ev.delta) text += ev.delta; } catch { /* skip */ }
            }
          }
          const parsed = JSON.parse(text || '{}') as { t?: unknown };
          if (Array.isArray(parsed.t) && parsed.t.length === todo.length) {
            todo.forEach(({ t, i }, k) => { const v = parsed.t as unknown[]; const s = typeof v[k] === 'string' ? (v[k] as string) : t; out[i] = s; cache.set(`${data.lang}\u0000${t}`, s); });
          }
        }
      } catch { /* fall back to originals */ }
    }
    return data.texts.map((t, i) => out[i] || t);
  });
