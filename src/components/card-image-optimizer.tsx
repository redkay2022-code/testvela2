import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cardPathOf, uploadCardImage } from '@/lib/card-image';

type Row = { id: string; media_urls: string[]; specs: unknown; signed_media_urls?: string[] };

/**
 * One-time helper for products uploaded before card pictures existed: makes a small card picture from each product's
 * first photo so the feed loads fast. Photos and everything else about the product stay as they are.
 */
export function CardImageOptimizer({ user, listings, onDone }: { user: User; listings: Row[]; onDone: () => void }) {
  const todo = listings.filter(l => l.media_urls[0] && !cardPathOf(l.specs) && l.signed_media_urls?.[0]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  if (!todo.length && !progress) return null;

  const run = async () => {
    if (progress) return;
    const queue = [...todo];
    setProgress({ done: 0, total: queue.length });
    let failed = 0;
    for (const l of queue) {
      try {
        const res = await fetch(l.signed_media_urls![0]!);
        if (!res.ok) throw new Error('download');
        const card = await uploadCardImage(await res.blob(), user.id);
        if (!card) throw new Error('card');
        const specs = l.specs && typeof l.specs === 'object' && !Array.isArray(l.specs) ? (l.specs as Record<string, unknown>) : {};
        const { error } = await supabase.from('posts').update({ specs: { ...specs, cardImage: card } as never }).eq('id', l.id).eq('user_id', user.id);
        if (error) { await supabase.storage.from('market-media').remove([card]); throw error; }
      } catch { failed++; }
      setProgress(p => p && { ...p, done: p.done + 1 });
    }
    setProgress(null);
    onDone();
    if (failed) alert(`${failed}개는 만들지 못했어요. 잠시 후 다시 눌러 주세요.`);
  };

  return <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm" data-i18n-skip data-no-translate translate="no">
    <span>{progress ? `미리보기 이미지를 만드는 중… ${progress.done}/${progress.total}` : `미리보기 이미지가 없는 상품 ${todo.length}개 · 가볍게 바꾸면 피드가 훨씬 빨리 떠요. (사진 원본은 그대로예요)`}</span>
    <Button size="sm" disabled={Boolean(progress)} onClick={() => void run()}>{progress ? '진행 중' : '미리보기 이미지 최적화'}</Button>
  </div>;
}
