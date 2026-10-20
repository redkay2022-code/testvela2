import { useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { useCurrency } from './currency';
import { cachedTranslation, queueTranslation } from '@/lib/translate-queue';
import { needsTranslation } from '@/lib/text-language';
import { Tx } from './tx';

const LATIN_LANGS = new Set(['en', 'de', 'fr', 'it', 'nl', 'la']);
/** 한글·일본어·중국어·러시아어·아랍어가 목표 언어면 글자 종류로 판단하고, 라틴 문자 언어는 글자가 있으면 항상 번역을 시도한다(이미 같은 언어면 원문 그대로 돌아온다). */
function shouldTranslate(text: string, lang: string) {
  const s = text.trim();
  if (!s || s.length > 3000 || (s.match(/\p{L}/gu) ?? []).length < 2) return false;
  return LATIN_LANGS.has(lang) ? true : needsTranslation(s, lang);
}

/**
 * 사용자가 직접 쓴 글(댓글, 리뷰, 문의, 공지, 스토어 소개, 메시지 ...).
 * 항상 보는 사람의 설정 언어로 자동 번역해 보여 주고, 번역된 글 아래에는 "원문 보기" 버튼이 있다.
 * 번역에 실패했는데 다른 언어로 보이는 글이면 원문과 함께 "번역 보기" 버튼으로 다시 시도할 수 있다.
 */
export function TranslatableText({ text, as: Tag = 'p', className }: { text: string; as?: 'p' | 'span' | 'div'; className?: string }) {
  const { lang } = useCurrency();
  const [original, setOriginal] = useState(false);
  const clean = text.trim();
  const eligible = shouldTranslate(text, lang);
  const looksForeign = eligible && needsTranslation(text, lang);
  const q = useQuery({
    queryKey: ['user-text-translation', lang, clean],
    queryFn: () => queueTranslation(lang, clean),
    initialData: eligible ? cachedTranslation(lang, clean) ?? undefined : undefined,
    enabled: eligible, staleTime: Infinity, retry: false,
  });
  const result = q.data && q.data.trim() !== clean ? q.data : null;
  const translated = !original && result ? result : null;
  const loading = eligible && !original && q.isFetching;
  const failed = looksForeign && !loading && !result && q.isFetched;
  const toggle = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); setOriginal(v => !v); };
  const retry = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); void q.refetch(); };
  const btn = 'inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline';

  return <>
    <Tag className={className} data-no-translate translate="no" data-i18n-skip>{translated ?? text}</Tag>
    {(loading || result || failed) && <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground notranslate" translate="no" data-no-translate>
      {loading ? <><Languages size={12} className="text-primary" /><Tx>Translating…</Tx></>
        : failed ? <button type="button" className={btn} onClick={retry}><Languages size={12} /><Tx>View translation (번역 보기)</Tx></button>
        : <>
          {translated && <><Languages size={12} className="text-primary" /><Tx>Translated by VELA AI</Tx></>}
          <button type="button" className={btn} onClick={toggle}>
            {!translated && <Languages size={12} />}
            <Tx>{translated ? 'View Original (원문 보기)' : 'View translation (번역 보기)'}</Tx>
          </button>
        </>}
    </div>}
  </>;
}
