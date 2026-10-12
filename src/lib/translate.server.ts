export const langNames: Record<string, string> = { en: 'English', ko: 'Korean', zh: 'Simplified Chinese', ja: 'Japanese', it: 'Italian', fr: 'French', de: 'German', nl: 'Dutch', ru: 'Russian', la: 'Latin', ar: 'Arabic' };

/** Translates strings via the Lovable AI Gateway (streamed). Returns null on any failure so callers keep originals. */
export async function translateBatch(lang: string, texts: string[]): Promise<string[] | null> {
  if (!texts.length) return [];
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
          { role: 'system', content: `Translate each string of a luxury watch marketplace into ${langNames[lang]}. Keep brand names, model codes, reference numbers, numbers, units and prices unchanged. Preserve line breaks. If a string is already in ${langNames[lang]}, return it unchanged. Return the same count and order.` },
          { role: 'user', content: JSON.stringify(texts) },
        ],
      }),
    });
    if (!res.ok || !res.body) return null;
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
    if (!Array.isArray(parsed.t) || parsed.t.length !== texts.length) return null;
    return parsed.t.map((v, i) => (typeof v === 'string' && v.trim() ? v : texts[i]!));
  } catch { return null; }
}
