import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { useCurrency } from './currency';
import { getPostTranslation } from '@/lib/translate.functions';
import { mergeSpecs } from '@/lib/post-translation';
import type { Post } from '@/lib/market';

/** Seller text in the buyer's app language, with a switch back to the original. */
export function usePostTranslation(post: Post, enabled = true) {
  const { lang } = useCurrency();
  const [original, setOriginal] = useState(false);
  const needs = enabled && Boolean(post.user_id) && post.source_lang !== lang;
  const q = useQuery({ queryKey: ['post-translation', post.id, lang, post.updated_at], queryFn: () => getPostTranslation({ data: { postId: post.id, lang } }), enabled: needs, staleTime: Infinity, retry: false });
  const tr = needs && !original ? q.data ?? null : null;
  return {
    title: tr?.title || post.title,
    description: tr?.description || post.description,
    specs: mergeSpecs(post.specs, tr?.specs),
    available: needs && Boolean(q.data),
    loading: needs && q.isFetching,
    original,
    toggle: () => setOriginal(v => !v),
  };
}

export function TranslationToggle({ t }: { t: ReturnType<typeof usePostTranslation> }) {
  if (!t.available && !t.loading) return null;
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground notranslate" translate="no" data-no-translate>
      <Languages size={13} className="text-primary" />
      {t.loading ? <span>Translating…</span> : <>
        <span>{t.original ? 'Original text' : 'Translated by VELA AI'}</span>
        <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={t.toggle}>{t.original ? 'View translation (번역 보기)' : 'View Original (원문 보기)'}</button>
      </>}
    </div>
  );
}
