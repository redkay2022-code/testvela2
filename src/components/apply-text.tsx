import type { ReactNode } from 'react';
import { tx } from '@/lib/dom-translate';
import { useCurrency } from './currency';

/* Translated UI text. The wrapper is marked so the DOM translator never re-translates what the dictionary already produced. */
export const frozen = { 'data-i18n-skip': true, 'data-no-translate': true, translate: 'no' as const };
export function T({ children }: { children: string }) {
  useCurrency();
  return <span {...frozen} className="notranslate">{tx(children)}</span>;
}
/** Numbers, limits, the fee rate and URLs: never translated, in any language. */
export function N({ children }: { children: ReactNode }) {
  return <span translate="no" className="notranslate" data-no-translate>{children}</span>;
}
/** A translated sentence whose {0}, {1} placeholders become untranslated <N> values. */
export function NT({ text, tokens }: { text: string; tokens: ReactNode[] }) {
  useCurrency();
  const parts = tx(text).split(/(\{\d\})/);
  return <span {...frozen} className="notranslate">{parts.map((part, i) => { const m = /^\{(\d)\}$/.exec(part); return m ? <N key={i}>{tokens[Number(m[1])]}</N> : part; })}</span>;
}
