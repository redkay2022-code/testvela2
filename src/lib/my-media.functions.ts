import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * 셀러가 자기 상품의 사진·영상 미리보기 주소를 받는 함수.
 * 스토리지 정책상 본인 폴더 밖에 저장된 파일은 브라우저에서 직접 서명할 수 없어서, 서버에서 소유자를 확인한 뒤 서명한다.
 */
export const signMyMedia = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100), full: z.boolean().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from('posts').select('id,media_urls,video_url,thumbnail_url,specs').in('id', data.ids).eq('user_id', context.userId);
    if (error) throw new Error('상품 미디어를 불러오지 못했어요.');
    type Row = { id: string; media_urls: string[] | null; video_url: string | null; thumbnail_url: string | null; specs: Record<string, unknown> | null };
    const list = (rows ?? []) as unknown as Row[];
    const card = (r: Row) => { const c = r.specs?.['cardImage']; return typeof c === 'string' && c && !/^https?:\/\//.test(c) ? c : ''; };
    const pick = (r: Row) => card(r) || r.media_urls?.[0] || r.thumbnail_url || '';
    const wanted = data.full ? list.flatMap(r => [...(r.media_urls ?? []), r.video_url ?? '']) : list.map(pick);
    const paths = [...new Set(wanted.filter(Boolean))];
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const urls = new Map<string, string>();
    for (let i = 0; i < paths.length; i += 100) {
      try {
        const { data: signed } = await supabaseAdmin.storage.from('market-media').createSignedUrls(paths.slice(i, i + 100), 3600);
        signed?.forEach(s => s.path && s.signedUrl && urls.set(s.path, s.signedUrl));
      } catch { /* 일부만 실패해도 나머지는 돌려준다 */ }
    }
    return Object.fromEntries(list.map(r => [r.id, {
      thumb: urls.get(pick(r)) ?? '',
      media: (r.media_urls ?? []).map(p => urls.get(p) ?? ''),
      video: r.video_url ? urls.get(r.video_url) ?? '' : '',
    }]));
  });
