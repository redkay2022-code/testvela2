import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const Caption = z.object({ start: z.number().min(0), end: z.number().min(0), text: z.string().max(200) });

/** Transcribes seller video audio into timed subtitles with Lovable AI. */
export const transcribeVideoAudio = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ wav: z.string().min(100).max(4_000_000), duration: z.number().positive().max(60), toEnglish: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error('자막 서비스가 설정되지 않았어요.');
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(data.wav, 'base64')], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', 'openai/gpt-transcribe');
    form.append('response_format', 'json');
    const res = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', { method: 'POST', headers: { 'Lovable-API-Key': key, Authorization: `Bearer ${key}`, 'X-Lovable-AIG-SDK': 'fetch' }, body: form });
    if (res.status === 429) throw new Error('요청이 많아요. 잠시 후 다시 시도해 주세요.');
    if (res.status === 402) throw new Error('AI 사용 한도가 부족해요.');
    if (!res.ok) throw new Error('자막을 만들지 못했어요.');
    const json = await res.json() as { text?: string; segments?: { start: number; end: number; text: string }[] };
    let captions: z.infer<typeof Caption>[] = (json.segments ?? []).map(s => ({ start: s.start, end: s.end, text: s.text.trim().slice(0, 200) }));
    if (!captions.length && json.text?.trim()) {
      // No timestamps returned: split sentences and spread them over the clip length by character share.
      const parts = json.text.trim().split(/(?<=[.!?。！？])\s+|\n+/).flatMap(p => p.match(/.{1,40}(\s|$)|.{1,40}/g) ?? []).map(p => p.trim()).filter(Boolean);
      const total = parts.reduce((n, p) => n + p.length, 0); let t = 0;
      captions = parts.map(p => { const d = (p.length / total) * data.duration; const c = { start: +t.toFixed(2), end: +(t + d).toFixed(2), text: p }; t += d; return c; });
    }
    const list = z.object({ captions: z.array(Caption) }).safeParse({ captions });
    let out = (list.success ? list.data.captions : []).filter(c => c.end > c.start && c.start < data.duration).slice(0, 60);
    if (data.toEnglish && out.length) out = await translateToEnglish(out, key);
    return out;
  });

/** Translates caption lines (e.g. Chinese speech) into natural English, keeping timings. */
async function translateToEnglish(caps: z.infer<typeof Caption>[], key: string) {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'fetch' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      reasoning: { effort: 'low' },
      instructions: 'Translate each subtitle line into concise natural English for a luxury watch video. Keep the same number and order of lines. Each line under 80 characters. Lines already in English stay as-is.',
      input: JSON.stringify(caps.map(c => c.text)),
      text: { format: { type: 'json_schema', name: 'subs', strict: true, schema: { type: 'object', additionalProperties: false, required: ['lines'], properties: { lines: { type: 'array', items: { type: 'string' } } } } } },
    }),
  });
  if (res.status === 429) throw new Error('요청이 많아요. 잠시 후 다시 시도해 주세요.');
  if (res.status === 402) throw new Error('AI 사용 한도가 부족해요.');
  if (!res.ok) throw new Error('영어 번역에 실패했어요.');
  const json = await res.json() as { output_text?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
  const txt = json.output_text ?? json.output?.flatMap(o => o.content ?? []).find(c => c.type === 'output_text')?.text ?? '';
  let lines: string[] = [];
  try { lines = (JSON.parse(txt) as { lines: string[] }).lines ?? []; } catch { throw new Error('영어 번역에 실패했어요.'); }
  return caps.map((c, i) => ({ ...c, text: (lines[i] ?? c.text).trim().slice(0, 200) }));
}
