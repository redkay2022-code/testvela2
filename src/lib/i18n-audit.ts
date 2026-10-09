/**
 * Translation coverage audit (development / test only — never imported by the app).
 *
 * It scans the source code for every piece of text a visitor can see (JSX text, placeholder/aria-label/title/alt
 * attributes, toast and dialog messages, labels stored in constants ...) and checks that each one has an entry in
 * every language dictionary in `src/locales/*.json`.
 *
 * Run it with:  npm run i18n:audit
 *
 * Conventions that keep the audit exact:
 *  - Dictionary keys are the text exactly as it appears in the source (Korean or English).
 *  - A dynamic string written as a template literal, e.g. `${name} 삭제`, is stored as "{0} 삭제" (tokens are numbered
 *    in order of appearance). The translation reuses the tokens: "Delete {0}".
 *  - Text that must never be translated (brand names, codes, units ...) goes in `src/lib/i18n-ignore.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import ignoreList from './i18n-ignore.json';

export const AUDIT_LANGS = ['en', 'ko', 'zh', 'ja', 'it', 'fr', 'de', 'nl', 'ru', 'la', 'ar'] as const;
export type AuditLang = (typeof AUDIT_LANGS)[number];
export type Found = { text: string; where: string };
export type Dictionaries = Record<AuditLang, Record<string, string>>;

const HANGUL = /[가-힣]/;
const CJK = /[぀-ヿ一-鿿]/;
const LATIN_WORD = /[A-Za-z]{2,}/;
const TOKEN = /\{\d+\}/g;

const UI_ATTRS = new Set(['placeholder', 'aria-label', 'title', 'alt', 'label', 'description']);
// Files that contain no visitor-facing text of their own.
const SKIP_FILE = /(\/ui\/|\/test\/|routeTree|\/integrations\/|\.functions\.ts$|\.server\.ts$|\/lib\/i18n(-audit)?\.ts$|\/lib\/dom-translate\.ts$|\/lib\/translate\.functions\.ts$|\.d\.ts$|\.gen\.ts$)/;
// String arguments of these calls are identifiers / selectors / column names, not text.
const TECHNICAL_CALLS = new Set([
  'from', 'select', 'eq', 'neq', 'in', 'is', 'or', 'and', 'order', 'rpc', 'insert', 'update', 'upsert', 'delete', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'match', 'filter', 'limit', 'range',
  'getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'closest', 'matches', 'getElementById', 'getAttribute', 'setAttribute', 'removeAttribute', 'createElement',
  'addEventListener', 'removeEventListener', 'matchMedia', 'add', 'remove', 'toggle', 'contains', 'append', 'get', 'set', 'has', 'delete', 'fetch', 'import', 'require', 'createFileRoute',
  'createServerFn', 'getUserMedia', 'createObjectURL', 'format', 'DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat', 'resolve', 'startsWith', 'endsWith', 'includes', 'indexOf', 'split', 'join',
  'replace', 'replaceAll', 'test', 'exec', 'match', 'padStart', 'padEnd', 'toFixed', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'postMessage', 'open', 'navigate', 'invalidate',
  'useState', 'useRef', 'createContext', 'z', 'string', 'enum', 'literal', 'object', 'parse', 'safeParse', 'storage', 'bucket', 'invoke', 'channel', 'on', 'off', 'emit', 'send', 'request', 'log', 'warn', 'error', 'debug', 'info',
]);

const ignoreExact = new Set<string>((ignoreList as { exact: string[] }).exact);
const ignorePatterns = (ignoreList as { patterns: string[] }).patterns.map(p => new RegExp(p, 'u'));
const isIgnored = (s: string) => ignoreExact.has(s) || ignorePatterns.some(r => r.test(s));

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/** True when the text looks like something a person reads (not an id, class list, URL, column list, number ...). */
export function looksHuman(s: string): boolean {
  if (s.length > 600 || (s.length < 2 && !HANGUL.test(s))) return false;
  if (!(HANGUL.test(s) || CJK.test(s) || LATIN_WORD.test(s))) return false;
  if (/^(https?:|\/|\.|#|@|data:|mailto:|tel:|blob:)/.test(s)) return false;
  if (/(^|\s)(flex|grid|px|py|mt|mb|ml|mr|bg|text|border|rounded|w|h|gap|absolute|relative|hover|focus|sm|md|lg|min|max|items|justify|font|shadow|opacity|z|overflow|inset|top|left|right|bottom|space|col|row|p|m)[-:[]/.test(s)) return false;
  if (!HANGUL.test(s) && !CJK.test(s)) {
    if (/^[a-z0-9_\-:./[\],*()=+&?%]+$/.test(s)) return false; // identifiers, slugs, column lists, css-like tokens
    if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(s)) return false; // camelCase
    if (/^[A-Z0-9_]+$/.test(s) && !s.includes(' ')) return false; // CONSTANT
    if (/^[A-Za-z]+(-|_)[A-Za-z0-9-_]+$/.test(s) && !s.includes(' ')) return false; // kebab / snake
    if (/^[A-Za-z0-9+/=]{24,}$/.test(s)) return false; // keys, hashes
  }
  const rest = s.replace(TOKEN, '').trim();
  if (/^[a-z0-9:_/.=\- ]+$/.test(rest) && /[-:_/.=]/.test(rest)) return false; // css classes, ids, urls, storage keys built from templates
  if (/^[\d\s.,:/\-+%$€¥₩()]+$/.test(s)) return false;
  if (/[{}<>;]|=>/.test(s.replace(TOKEN, '')) && !s.includes(' ')) return false;
  return true;
}

/** Collects every candidate UI string with its location. Dynamic template literals use numbered {0} {1} tokens. */
export function extractStrings(srcDir: string): Found[] {
  const found = new Map<string, string>();
  for (const file of walkFiles(srcDir)) {
    const norm = file.split(path.sep).join('/');
    if (SKIP_FILE.test(norm)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const rel = path.relative(srcDir, file).split(path.sep).join('/');
    const add = (raw: string, node: ts.Node) => {
      const s = raw.replace(/\s+/g, ' ').trim();
      if (!s || !looksHuman(s) || isIgnored(s)) return;
      if (!found.has(s)) found.set(s, `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    };
    const inTechnicalContext = (n: ts.Node): boolean => {
      const p = n.parent;
      if (!p) return false;
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isCaseClause(p) || ts.isExternalModuleReference(p)) return true;
      if (ts.isPropertyAssignment(p) && p.name === n) return true;
      if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return true;
      if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
      if (ts.isCallExpression(p) && p.arguments.includes(n as ts.Expression)) {
        const callee = p.expression;
        const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
        if (TECHNICAL_CALLS.has(name)) return true;
      }
      if (ts.isJsxAttribute(p)) return true; // attributes are handled explicitly
      return false;
    };
    const visit = (n: ts.Node) => {
      if (ts.isJsxText(n)) add(n.getText(), n);
      else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && UI_ATTRS.has(n.name.getText())) add(n.initializer.text, n);
      else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        if (!inTechnicalContext(n)) add(n.text, n);
      } else if (ts.isTemplateExpression(n) && !inTechnicalContext(n)) {
        let key = n.head.text;
        n.templateSpans.forEach((span, i) => { key += `{${i}}${span.literal.text}`; });
        const stat = key.replace(TOKEN, '');
        if (HANGUL.test(stat) || /[A-Za-z]{3,}/.test(stat)) add(key, n);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return [...found].map(([text, where]) => ({ text, where }));
}

/** True when the text is already written in the target language's script, so it needs no dictionary entry. */
export function isNativeTo(lang: AuditLang, text: string): boolean {
  if (lang === 'ko') return HANGUL.test(text) || !/[A-Za-z]{3,}/.test(text);
  if (lang === 'en') return !HANGUL.test(text) && !CJK.test(text);
  return false;
}

/** Mirrors the runtime lookup: exact entry, then every " · " separated segment. */
export function isCovered(lang: AuditLang, text: string, dict: Record<string, string>): boolean {
  if (dict[text] !== undefined) return true;
  if (isNativeTo(lang, text)) return true;
  if (text.includes(' · ')) return text.split(' · ').every(part => dict[part] !== undefined || isNativeTo(lang, part) || !looksHuman(part) || isIgnored(part));
  return false;
}

export function loadDictionaries(localesDir: string): Dictionaries {
  const out = {} as Dictionaries;
  for (const l of AUDIT_LANGS) out[l] = JSON.parse(fs.readFileSync(path.join(localesDir, `${l}.json`), 'utf8')) as Record<string, string>;
  return out;
}

/** Per language: every visible string that has no translation. */
export function runAudit(srcDir: string): Record<AuditLang, Found[]> {
  const strings = extractStrings(srcDir);
  const dicts = loadDictionaries(path.join(srcDir, 'locales'));
  const result = {} as Record<AuditLang, Found[]>;
  for (const l of AUDIT_LANGS) result[l] = strings.filter(f => !isCovered(l, f.text, dicts[l]));
  return result;
}

/** Dictionary hygiene: placeholders must match the source key, and no entry may be empty. */
export function checkDictionaryIntegrity(dicts: Dictionaries): string[] {
  const problems: string[] = [];
  for (const l of AUDIT_LANGS) {
    for (const [key, value] of Object.entries(dicts[l])) {
      if (!value.trim() && value !== '') problems.push(`${l}: blank translation for "${key}"`);
      const want = [...key.matchAll(TOKEN)].map(m => m[0]).sort().join();
      const have = [...value.matchAll(TOKEN)].map(m => m[0]).sort().join();
      if (want !== have) problems.push(`${l}: tokens differ for "${key}" -> "${value}"`);
    }
  }
  return problems;
}

export function formatReport(result: Record<AuditLang, Found[]>, limit = 25): string {
  const lines: string[] = [];
  for (const l of AUDIT_LANGS) {
    const list = result[l];
    if (!list.length) continue;
    lines.push(`\n[${l}] ${list.length} untranslated`);
    list.slice(0, limit).forEach(f => lines.push(`  ${f.where.padEnd(34)} ${JSON.stringify(f.text.length > 90 ? `${f.text.slice(0, 90)}…` : f.text)}`));
    if (list.length > limit) lines.push(`  … and ${list.length - limit} more`);
  }
  return lines.join('\n');
}
