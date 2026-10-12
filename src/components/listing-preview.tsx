import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { ProductDetailContent } from './product-detail-content';
import { unknownReputation } from '@/lib/reputation';
import type { LuxuryPost } from '@/lib/luxury-market';
import type { Post } from '@/lib/market';

export type PreviewListing = {
  id: string; title: string; description: string; category: string; price: number | null; box_price: number | null;
  status: string; specs: Record<string, unknown>; media_urls: string[]; video_url: string | null;
  signed_media_urls?: string[]; signed_video_url?: string | undefined; dispatch_time?: string | null | undefined;
};

/** Builds the same post object buyers see, from a seller's own listing (signed URLs for private media). */
export function previewPost(l: PreviewListing, creator: string): LuxuryPost {
  const images = (l.signed_media_urls ?? []).filter(Boolean);
  const video = l.signed_video_url ?? null;
  const specs = l.specs ?? {};
  const menu = typeof specs['menuCategory'] === 'string' ? specs['menuCategory'] : undefined;
  const source = { id: l.id, title: l.title, description: l.description, category: l.category, price: l.price, box_price: l.box_price, dispatch_time: l.dispatch_time ?? null, specs, media_urls: l.media_urls, video_url: l.video_url, user_id: null, store_id: null, source_lang: 'ko', updated_at: '', translations: null, status: l.status, product_status: null, base_likes: 0, creator } as unknown as Post;
  return { menuCategory: menu, id: l.id, title: l.title, description: l.description, creator, images, video, short: Boolean(video), price: l.price, boxPrice: l.box_price, factory: typeof specs['factory'] === 'string' ? specs['factory'] : l.category, category: l.category, views: '0', likes: 0, verified: false, sample: false, source, reputation: unknownReputation };
}

export function ListingPreview({ listing, user, onClose }: { listing: PreviewListing; user: User | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; }; }, [onClose]);
  const post = previewPost(listing, '내 스토어');
  return <div className="fixed inset-0 z-[80] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="상품 미리보기">
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0"><p className="text-sm font-semibold">미리보기 · 구매자에게 보이는 상세 화면</p><p className="text-xs text-muted-foreground">{listing.status === 'published' ? '판매 중인 상품이에요.' : '임시 저장 상태예요. 판매를 켜기 전까지는 구매자에게 보이지 않아요.'} 이 화면에서는 구매·메시지가 작동하지 않아요.</p></div>
      <Button size="icon" variant="ghost" aria-label="미리보기 닫기" onClick={onClose}><X /></Button>
    </div>
    {note && <p className="bg-muted px-4 py-2 text-center text-xs" role="status">{note}</p>}
    <div className="relative min-h-0 flex-1 overflow-y-auto"><div className="lux-detail-page mx-auto max-w-xl"><ProductDetailContent key={post.id} post={post} user={user} requestAuth={() => setNote('미리보기에서는 로그인이 필요하지 않아요.')} buy={() => setNote('미리보기에서는 구매할 수 없어요.')} notify={t => setNote(t)} /></div></div>
  </div>;
}
