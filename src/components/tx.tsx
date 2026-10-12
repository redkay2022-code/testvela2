import { tx } from '@/lib/dom-translate';

/**
 * Static UI label rendered straight from the platform's translation dictionary for the current language.
 * Translated labels are marked so the DOM translator never touches them again; if no entry exists the original
 * text is rendered unchanged (graceful fallback, no browser or external translation involved).
 */
export function Tx({ children }: { children: string }) {
  const out = tx(children);
  return out === children ? <>{children}</> : <span data-no-translate="" className="notranslate" translate="no">{out}</span>;
}
