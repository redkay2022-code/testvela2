import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { isMuxStreamUrl, muxThumbnailUrl } from './mux';

/**
 * 공동구매 링크(/group/…) 화면에 보여줄 상품 사진·설명·가격. 로그인하지 않은 방문자도 볼 수 있어야 하므로 서버에서 만든다.
 * 존재하는 공동구매의 상품 정보만 돌려준다. 사진 주소는 1시간짜리 임시 주소다.
 */
export const getGroupPreview = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ groupId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const empty = { image: null as string | null, description: '', category: '', price: null as number | null, boxPrice: 0 };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const g = await supabaseAdmin.from('group_purchases' as never).select('product_id').eq('id', data.groupId).maybeSingle();
    const productId = (g.data as { product_id?: string } | null)?.product_id;
    if (!productId) return empty;
    const { data: p } = await supabaseAdmin.from('posts').select('description,category,price,box_price,media_urls,thumbnail_url,video_url,specs').eq('id', productId).maybeSingle();
    if (!p) return empty;
    const specs = p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs) ? p.specs as Record<string, unknown> : {};
    const card = typeof specs['cardImage'] === 'string' ? specs['cardImage'] as string : null;
    const custom = specs['customThumb'] === 'true' && p.video_url && p.thumbnail_url ? p.thumbnail_url : null;
    let image: string | null = null;
    if (isMuxStreamUrl(p.video_url) && !custom && !(p.media_urls ?? []).length) image = muxThumbnailUrl(p.video_url);
    else {
      const path = [card, p.media_urls?.[0], custom, p.thumbnail_url].find((x): x is string => Boolean(x) && !x!.startsWith('seed:') && !x!.includes('..'));
      if (path) {
        if (/^https?:\/\//.test(path)) image = path;
        else { const s = await supabaseAdmin.storage.from('market-media').createSignedUrl(path, 3600); image = s.data?.signedUrl ?? null; }
      }
    }
    return { image, description: String(p.description ?? '').slice(0, 300), category: String(p.category ?? ''), price: p.price ?? null, boxPrice: Number(p.box_price ?? 0) };
  });
