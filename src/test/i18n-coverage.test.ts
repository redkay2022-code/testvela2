// @vitest-environment node
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIT_LANGS, checkDictionaryIntegrity, formatReport, loadDictionaries, runAudit } from '../lib/i18n-audit';

const srcDir = path.resolve(__dirname, '..');

describe('language switching coverage', () => {
  it('every visible text in the code has a translation in all 11 languages', () => {
    const result = runAudit(srcDir);
    const missing = AUDIT_LANGS.reduce((n, l) => n + result[l].length, 0);
    // The report lists the exact text and file:line to add to src/locales/<lang>.json
    expect(missing, formatReport(result)).toBe(0);
  });

  it('dictionaries are well formed (same {0} {1} placeholders as the source text)', () => {
    const problems = checkDictionaryIntegrity(loadDictionaries(path.join(srcDir, 'locales')));
    expect(problems, problems.slice(0, 20).join('\n')).toEqual([]);
  });
});
