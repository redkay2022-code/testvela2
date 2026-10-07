import type { Lang } from './i18n';

// Per-language dictionaries (source UI string -> translation), loaded on demand.
const loaders = import.meta.glob<{ default: Record<string, string> }>('../locales/*.json');
const ATTRS = ['aria-label', 'placeholder', 'title'] as const;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'NOSCRIPT']);

let observer: MutationObserver | null = null;
let dict: Record<string, string> = {};
const written = new WeakMap<Node, { orig: string; out: string }>();
const attrWritten = new WeakMap<Element, Record<string, { orig: string; out: string }>>();

function tr(text: string): string | null {
  const s = text.trim();
  if (!s || s.length > 260) return null;
  const hit = dict[s];
  if (hit) return text.replace(s, hit);
  if (s.includes(' · ')) {
    const parts = s.split(' · ').map(p => dict[p] ?? p);
    const uniq = parts.filter((p, i) => parts.indexOf(p) === i);
    const joined = uniq.join(' · ');
    return joined !== s ? text.replace(s, joined) : null;
  }
  return null;
}
function textNode(n: Text) {
  if (n.parentElement && SKIP.has(n.parentElement.tagName)) return;
  const rec = written.get(n);
  const source = rec && rec.out === n.data ? rec.orig : n.data;
  const next = tr(source) ?? source;
  if (next !== n.data) n.data = next;
  written.set(n, { orig: source, out: next });
}
function element(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const recs = attrWritten.get(el) ?? {};
    const rec = recs[a];
    const source = rec && rec.out === v ? rec.orig : v;
    const next = tr(source) ?? source;
    recs[a] = { orig: source, out: next }; attrWritten.set(el, recs);
    if (next !== v) el.setAttribute(a, next);
  }
}
function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return textNode(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP.has(el.tagName)) return;
  element(el);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === Node.TEXT_NODE ? textNode(n as Text) : element(n as Element);
}

/** Translates static UI text on screen into `lang`; user-written content without a dictionary match is left as-is. */
export async function applyDomTranslation(lang: Lang) {
  observer?.disconnect(); observer = null;
  const load = loaders[`../locales/${lang}.json`];
  dict = load ? (await load()).default : {};
  walk(document.body);
  observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') textNode(m.target as Text);
      else if (m.type === 'attributes') element(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}
