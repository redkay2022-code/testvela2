import type { Lang } from './i18n';
import { translateTexts } from './translate.functions';

// Per-language dictionaries (source UI string -> translation), loaded on demand.
const loaders = import.meta.glob<{ default: Record<string, string> }>('../locales/*.json');
const ATTRS = ['aria-label', 'placeholder', 'title'] as const;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'NOSCRIPT', 'INPUT', 'SELECT', 'OPTION']);

let observer: MutationObserver | null = null;
let dict: Record<string, string> = {};
let lang: Lang = 'en';
const written = new WeakMap<Node, { orig: string; out: string }>();
const attrWritten = new WeakMap<Element, Record<string, { orig: string; out: string }>>();

// Machine translations for seller/user-written text (no dictionary entry), cached per language.
const machine: Record<string, Record<string, string>> = {};
const pending = new Set<string>();
const waiting = new Set<Text>();
let timer: ReturnType<typeof setTimeout> | null = null;
const LETTERS = /\p{L}{2,}/u;
const skipMachine = (el: Element | null) => !!el?.closest('[data-no-translate],[contenteditable],.lux-lang-menu');

function loadMachine(l: Lang): Record<string, string> {
  const hit = machine[l]; if (hit) return hit;
  let m: Record<string, string> = {}; try { m = JSON.parse(localStorage.getItem(`vela-mt-${l}`) ?? "{}"); } catch { /* ignore */ }
  machine[l] = m; return m;
}
function saveMachine(l: Lang) { try { localStorage.setItem(`vela-mt-${l}`, JSON.stringify(machine[l])); } catch { /* storage full */ } }

function flush() {
  timer = null;
  const l = lang, batch = [...pending].slice(0, 40);
  batch.forEach(s => pending.delete(s));
  if (!batch.length) return;
  translateTexts({ data: { lang: l, texts: batch } }).then(res => {
    const m = loadMachine(l);
    batch.forEach((s, i) => { m[s] = res[i] ?? s; });
    saveMachine(l);
    if (l !== lang) return;
    waiting.forEach(n => { if (n.isConnected) textNode(n); });
    waiting.clear();
  }).catch(() => { /* keep originals */ }).finally(() => { if (pending.size && !timer) timer = setTimeout(flush, 250); });
}

function tr(text: string, node?: Text): string | null {
  const s = text.trim();
  if (!s || s.length > 600) return null;
  const hit = dict[s];
  if (hit) return text.replace(s, hit);
  if (s.includes(' · ')) {
    const parts = s.split(' · ').map(p => dict[p] ?? p);
    const uniq = parts.filter((p, i) => parts.indexOf(p) === i);
    const joined = uniq.join(' · ');
    if (joined !== s) return text.replace(s, joined);
  }
  if (!node || !LETTERS.test(s) || skipMachine(node.parentElement) || alreadyTarget(s)) return null;
  const m = loadMachine(lang)[s];
  if (m) return m === s ? null : text.replace(s, m);
  pending.add(s); waiting.add(node);
  if (!timer) timer = setTimeout(flush, 250);
  return null;
}
// Skip machine calls for text already written in the target language's script (avoids wasted calls, keeps fallback to original).
const HANGUL = /[\uac00-\ud7a3]/, CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;
function alreadyTarget(s: string) {
  if (lang === 'ko') return HANGUL.test(s) || !/[A-Za-z]{3,}/.test(s);
  if (lang === 'en') return !HANGUL.test(s) && !CJK.test(s);
  return false;
}
function textNode(n: Text) {
  if (n.parentElement && SKIP.has(n.parentElement.tagName)) return;
  const rec = written.get(n);
  const source = rec && rec.out === n.data ? rec.orig : n.data;
  const next = tr(source, n) ?? source;
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

/** Translates on-screen text into `lang`: UI strings via dictionaries, seller/user-written text via cached machine translation. */
export async function applyDomTranslation(next: Lang) {
  observer?.disconnect(); observer = null;
  lang = next; pending.clear(); waiting.clear();
  const load = loaders[`../locales/${next}.json`];
  dict = load ? (await load()).default : {};
  walk(document.body);
  translateMeta();
  observer = new MutationObserver(muts => {
    // Never let a translation glitch break the page; skip the node instead.
    for (const m of muts) {
      try {
        if (m.type === 'characterData') textNode(m.target as Text);
        else if (m.type === 'attributes') element(m.target as Element);
        else m.addedNodes.forEach(walk);
      } catch { /* leave original text */ }
    }
  });
  headObserver?.disconnect();
  headObserver = new MutationObserver(() => translateMeta());
  headObserver.observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ['content'] });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

// Page description meta tags follow the selected language (dictionary first, then cached machine translation).
let headObserver: MutationObserver | null = null;
const META = 'meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]';
const metaOrig = new WeakMap<Element, { orig: string; out: string }>();
function translateMeta() {
  document.querySelectorAll(META).forEach(el => {
    const v = el.getAttribute('content') ?? '';
    const rec = metaOrig.get(el);
    const source = rec && rec.out === v ? rec.orig : v;
    if (!source.trim()) return;
    const set = (out: string) => { metaOrig.set(el, { orig: source, out }); if (el.getAttribute('content') !== out) el.setAttribute('content', out); };
    const hit = dict[source] ?? loadMachine(lang)[source];
    if (hit) return set(hit);
    if (alreadyTarget(source)) return set(source);
    set(source);
    const l = lang;
    translateTexts({ data: { lang: l, texts: [source] } }).then(([out]) => {
      if (!out) return; const m = loadMachine(l); m[source] = out; saveMachine(l);
      if (l === lang && el.isConnected && metaOrig.get(el)?.orig === source) set(out);
    }).catch(() => { /* keep original */ });
  });
}
