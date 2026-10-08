import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export type JamendoTrack = { id: string; name: string; artist_name: string; duration: number; audio: string; audiodownload: string; image: string; license_ccurl: string };

export const searchJamendo = createServerFn({ method: 'GET' })
  .inputValidator((d) => z.object({ search: z.string().max(100).default(''), tags: z.string().max(50).default(''), offset: z.number().int().min(0).max(2000).default(0) }).parse(d))
  .handler(async ({ data }): Promise<{ tracks: JamendoTrack[]; error?: string }> => {
    const clientId = process.env['JAMENDO_CLIENT_ID'];
    if (!clientId) return { tracks: [], error: '음악 서비스 설정이 아직 완료되지 않았습니다.' };
    const p = new URLSearchParams({ client_id: clientId, format: 'json', limit: '20', include: 'licenses musicinfo', audioformat: 'mp32', offset: String(data.offset) });
    if (data.search.trim()) p.set('search', data.search.trim());
    if (data.tags) p.set('tags', data.tags);
    try {
      const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${p}`);
      if (!res.ok) return { tracks: [], error: '음악을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' };
      const json = (await res.json()) as { headers?: { status?: string }; results?: Array<Record<string, string | number | null>> };
      if (json.headers?.status && json.headers.status !== 'success') return { tracks: [], error: '음악 검색에 실패했습니다.' };
      return { tracks: (json.results ?? []).map((r: any) => ({ id: String(r.id), name: String(r.name ?? ''), artist_name: String(r.artist_name ?? ''), duration: Number(r.duration ?? 0), audio: String(r.audio ?? ''), audiodownload: String(r.audiodownload ?? ''), image: String(r.image ?? ''), license_ccurl: String(r.license_ccurl ?? '') })) };
    } catch {
      return { tracks: [], error: '네트워크 오류로 음악을 불러오지 못했습니다.' };
    }
  });
