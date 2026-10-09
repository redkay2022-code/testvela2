import type { Lang } from './i18n';
import { translateTexts } from './translate.functions';

// Per-language dictionaries (source UI string -> translation), loaded on demand.
// A key may contain {tokens} (e.g. "{0} 삭제" -> "Delete {0}") to cover dynamic strings built from template literals.
const loaders = import.meta.glob<{ default: Record<string, string> }>('../locales/*.json');
// `value` is only translated on <input type="button|submit|reset"> (see element()).
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'value'] as const;
// Elements whose text content must never be touched (attributes such as placeholder are still translated).
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'NOSCRIPT']);
const BUTTON_INPUT = /^(button|submit|reset)$/i;
/** Put `data-i18n-skip` on any element whose whole subtree must stay untouched (e.g. the language picker's native names). */
const SKIP_ATTR = '[data-i18n-skip]';
const skipped = (el: Element | null) => !!el?.closest(SKIP_ATTR);

let observer: MutationObserver | null = null;
let dict: Record<string, string> = {};
let patterns: Pattern[] = [];
let lang: Lang = 'en';
const written = new WeakMap<Node, { orig: string; out: string }>();
const attrWritten = new WeakMap<Element, Record<string, { orig: string; out: string }>>();

// ---------------------------------------------------------------------------------------------
// Dictionary keys containing {tokens} are compiled to regular expressions.
// ---------------------------------------------------------------------------------------------
type Pattern = { re: RegExp; names: string[]; out: string; weight: number };
const TOKEN = /\{(\w+)\}/g;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compilePatterns(d: Record<string, string>): Pattern[] {
  const list: Pattern[] = [];
  for (const [key, out] of Object.entries(d)) {
    if (!/\{\w+\}/.test(key)) continue;
    const names: string[] = [];
    let src = '', last = 0, literal = 0;
    for (const m of key.matchAll(TOKEN)) {
      const at = m.index ?? 0;
      const chunk = key.slice(last, at);
      literal += chunk.trim().length;
      src += escapeRe(chunk) + '([^·]+?)'; // a value never spans a " · " separator, so segment-level entries stay reachable
      names.push(m[1] ?? '');
      last = at + m[0].length;
    }
    const tail = key.slice(last);
    literal += tail.trim().length;
    src += escapeRe(tail);
    if (!literal) continue; // a key made only of tokens would match everything
    try { list.push({ re: new RegExp(`^${src}$`, 's'), names, out, weight: literal }); } catch { /* invalid pattern: ignore */ }
  }
  // Most specific (longest literal text) first.
  return list.sort((a, b) => b.weight - a.weight);
}

function applyPattern(s: string): string | null {
  for (const p of patterns) {
    const m = p.re.exec(s);
    if (!m) continue;
    const vals: Record<string, string> = {};
    p.names.forEach((n, i) => { if (!(n in vals)) vals[n] = m[i + 1] ?? ''; });
    return p.out.replace(TOKEN, (_all, n: string) => { const v = vals[n] ?? ''; return dict[v] ?? v; });
  }
  return null;
}

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

/** Replaces `s` inside `text` without interpreting `$&`, `$1` ... that may appear in a translation. */
const put = (text: string, s: string, out: string) => text.replace(s, () => out);

/** Dictionary + pattern lookup for one trimmed string (no network, no DOM). */
function lookup(s: string): string | null {
  return dict[s] !== undefined ? dict[s] : applyPattern(s);
}

/** Dictionary-only translation of a full string: exact entry, then {token} patterns, then " · " separated segments. */
function translateKnown(s: string): string | null {
  const exact = dict[s];
  if (exact !== undefined) return exact;
  const whole = applyPattern(s);
  if (whole !== null) return whole;
  if (s.includes(' · ')) {
    let hit = false;
    const parts = s.split(' · ').map(p => { const r = lookup(p); if (r !== null) hit = true; return r ?? p; });
    if (hit) return parts.join(' · ');
  }
  return null;
}

function tr(text: string, node?: Text): string | null {
  const s = text.trim();
  if (!s || s.length > 600) return null;
  const known = translateKnown(s);
  if (known !== null) return put(text, s, known);
  if (!node || !LETTERS.test(s) || skipMachine(node.parentElement) || alreadyTarget(s)) return null;
  const m = loadMachine(lang)[s];
  if (m) return m === s ? null : put(text, s, m);
  pending.add(s); waiting.add(node);
  if (!timer) timer = setTimeout(flush, 250);
  return null;
}
// Skip machine calls for text already written in the target language's script (avoids wasted calls, keeps fallback to original).
const HANGUL = /[가-힣]/, CJK = /[぀-ヿ一-鿿]/;
function alreadyTarget(s: string) {
  if (lang === 'ko') return HANGUL.test(s) || !/[A-Za-z]{3,}/.test(s);
  if (lang === 'en') return !HANGUL.test(s) && !CJK.test(s);
  return false;
}
function textNode(n: Text) {
  if (n.parentElement?.closest('[lang="ko"][data-no-translate]')) return;
  if (skipped(n.parentElement)) return;
  if (n.parentElement && SKIP.has(n.parentElement.tagName)) return;
  const rec = written.get(n);
  const source = rec && rec.out === n.data ? rec.orig : n.data;
  const next = tr(source, n) ?? source;
  if (next !== n.data) n.data = next;
  written.set(n, { orig: source, out: next });
}
function element(el: Element) {
  if (el.closest('[lang="ko"][data-no-translate]') || skipped(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    // `value` carries user input everywhere except on push-button inputs.
    if (a === 'value' && !(el.tagName === 'INPUT' && BUTTON_INPUT.test(el.getAttribute('type') ?? ''))) continue;
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
  if (skipped(el)) return;
  element(el); // attributes (placeholder, alt, ...) are translated even on <input>, <select>, <textarea>
  if (SKIP.has(el.tagName)) return;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => (n.nodeType === Node.ELEMENT_NODE && (n as Element).hasAttribute('data-i18n-skip') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === Node.TEXT_NODE ? textNode(n as Text) : element(n as Element);
}

/** Translates on-screen text into `lang`: UI strings via dictionaries, seller/user-written text via cached machine translation. */
export async function applyDomTranslation(next: Lang) {
  observer?.disconnect(); observer = null;
  lang = next; pending.clear(); waiting.clear();
  const load = loaders[`../locales/${next}.json`];
  dict = load ? (await load()).default : {};
  patterns = compilePatterns(dict);
  installDialogTranslation();
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
  headObserver.observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['content'] });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

// Page title and description meta tags follow the selected language (dictionary first, then cached machine translation).
let headObserver: MutationObserver | null = null;
const META = 'meta[name="description"],meta[property="og:description"],meta[name="twitter:description"],meta[property="og:title"],meta[name="twitter:title"]';
const metaOrig = new WeakMap<Element, { orig: string; out: string }>();
let titleRec: { orig: string; out: string } | null = null;

/** Translates a head string (title / meta): dictionary, cached machine translation, else asks the server once. */
function headText(source: string, apply: (out: string) => void, stillCurrent: () => boolean) {
  const hit = translateKnown(source) ?? dict[source] ?? loadMachine(lang)[source];
  if (hit) return apply(hit);
  apply(source);
  if (alreadyTarget(source) || !LETTERS.test(source)) return;
  const l = lang;
  translateTexts({ data: { lang: l, texts: [source] } }).then(([out]) => {
    if (!out) return; const m = loadMachine(l); m[source] = out; saveMachine(l);
    if (l === lang && stillCurrent()) apply(out);
  }).catch(() => { /* keep original */ });
}

function translateMeta() {
  const title = document.title;
  if (title) {
    const source = titleRec && titleRec.out === title ? titleRec.orig : title;
    headText(source, out => { titleRec = { orig: source, out }; if (document.title !== out) document.title = out; }, () => titleRec?.orig === source);
  }
  document.querySelectorAll(META).forEach(el => {
    const v = el.getAttribute('content') ?? '';
    const rec = metaOrig.get(el);
    const source = rec && rec.out === v ? rec.orig : v;
    if (!source.trim()) return;
    headText(source, out => { metaOrig.set(el, { orig: source, out }); if (el.getAttribute('content') !== out) el.setAttribute('content', out); }, () => el.isConnected && metaOrig.get(el)?.orig === source);
  });
}

// ---------------------------------------------------------------------------------------------
// Native dialogs (alert / confirm / prompt) are not part of the DOM, so they are translated here.
// ---------------------------------------------------------------------------------------------
/** Synchronous translation for text that never reaches the DOM (dictionary, patterns and cached machine translations). */
export function translateText(message: string): string {
  const whole = message.trim();
  if (!whole) return message;
  const known = translateKnown(whole) ?? loadMachine(lang)[whole];
  if (known != null) return put(message, whole, known);
  if (!message.includes('\n')) return message;
  return message.split('\n').map(line => { const t = line.trim(); const k = t ? translateKnown(t) ?? loadMachine(lang)[t] : null; return k ? put(line, t, k) : line; }).join('\n');
}

let dialogsPatched = false;
/** Makes window.alert / confirm / prompt show the message in the selected language. Safe to call repeatedly. */
export function installDialogTranslation() {
  if (dialogsPatched || typeof window === 'undefined') return;
  dialogsPatched = true;
  const w = window as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const name of ['alert', 'confirm', 'prompt']) {
    const original = w[name]?.bind(window);
    if (!original) continue;
    w[name] = (message?: unknown, ...rest: unknown[]) => original(typeof message === 'string' ? translateText(message) : message, ...rest);
  }
}
