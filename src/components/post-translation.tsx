import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { useCurrency } from './currency';
import { getPostTranslation } from '@/lib/translate.functions';
import { mergeSpecs } from '@/lib/post-translation';
import type { Post } from '@/lib/market';
import { Tx } from './tx';
import { Button } from './ui/button';

/** Seller text in the buyer's app language, with a switch back to the original. */
export function usePostTranslation(post: Post, enabled = true, auto = true) {
  const { lang } = useCurrency();
  // auto: the translation is shown by default and `flip` switches to the original.
  // manual (auto=false): the original is shown by default and `flip` asks for the translation (fetched only then).
  const [flip, setFlip] = useState(false);
  const wantTranslation = auto ? !flip : flip;
  const needs = enabled && Boolean(post.user_id) && post.source_lang !== lang;
  const q = useQuery({ queryKey: ['post-translation', post.id, lang, post.updated_at], queryFn: () => getPostTranslation({ data: { postId: post.id, lang } }), enabled: needs && (auto || flip), staleTime: Infinity, retry: false });
  const tr = needs && wantTranslation ? q.data ?? null : null;
  return {
    title: tr?.title || post.title,
    description: tr?.description || post.description,
    specs: mergeSpecs(post.specs, tr?.specs),
    available: needs && (auto ? Boolean(q.data) : true),
    loading: needs && wantTranslation && q.isFetching,
    failed: needs && !auto && flip && !q.isFetching && !q.data,
    original: !wantTranslation,
    toggle: () => setFlip(v => !v),
  };
}

export function TranslationToggle({ t }: { t: ReturnType<typeof usePostTranslation> }) {
  if (!t.available && !t.loading) return null;
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground notranslate" translate="no" data-no-translate>
      <Languages size={13} className="text-primary" />
      {t.loading ? <Tx>Translating…</Tx> : <>
        <Tx>{t.failed ? 'No translation available' : t.original ? 'Original text' : 'Translated by VELA AI'}</Tx>
        <Button variant="link" size="sm" className="h-auto whitespace-normal p-0 text-[11px]" onClick={t.toggle}><Tx>{t.original ? 'View translation (번역 보기)' : 'View Original (원문 보기)'}</Tx></Button>
      </>}
    </div>
  );
}
