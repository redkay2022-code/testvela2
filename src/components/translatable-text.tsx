import { useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { useCurrency } from './currency';
import { translateTexts } from '@/lib/translate.functions';
import { needsTranslation } from '@/lib/text-language';
import { Tx } from './tx';

/**
 * User-written text (comments, reviews, messages ...) shown as typed, with a small YouTube-style
 * "View translation" button underneath when the text looks like it is in another language.
 * Nothing is translated until the viewer asks; "View Original" switches back.
 */
export function TranslatableText({ text, as: Tag = 'p', className }: { text: string; as?: 'p' | 'span' | 'div'; className?: string }) {
  const { lang } = useCurrency();
  const [show, setShow] = useState(false);
  const eligible = needsTranslation(text, lang);
  const q = useQuery({
    queryKey: ['user-text-translation', lang, text],
    queryFn: async () => (await translateTexts({ data: { lang, texts: [text.trim()] } }))[0] ?? text,
    enabled: eligible && show,
    staleTime: Infinity,
    retry: false,
  });
  const translated = show && q.data && q.data.trim() !== text.trim() ? q.data : null;
  const unavailable = show && q.isFetched && !q.isFetching && !translated;
  const loading = show && q.isFetching;
  const click = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); setShow(v => !v); };

  return <>
    <Tag className={className} data-no-translate translate="no" data-i18n-skip>{translated ?? text}</Tag>
    {eligible && <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground notranslate" translate="no" data-no-translate>
      {loading ? <><Languages size={12} className="text-primary" /><Tx>Translating…</Tx></>
        : unavailable ? <Tx>No translation available</Tx>
        : <>
          {translated && <><Languages size={12} className="text-primary" /><Tx>Translated by VELA AI</Tx></>}
          <button type="button" className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline" onClick={click}>
            {!translated && <Languages size={12} />}
            <Tx>{translated ? 'View Original (원문 보기)' : 'View translation (번역 보기)'}</Tx>
          </button>
        </>}
    </div>}
  </>;
}
