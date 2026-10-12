import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveLang } from '@/lib/i18n';
import { labelFor } from '@/lib/label-lookup';
import { mergeSpecs } from '@/lib/post-translation';

vi.mock('@/lib/translate.functions', () => ({ translateTexts: vi.fn().mockResolvedValue([]) }));
import { applyDomTranslation, loadDictionary, tx } from '@/lib/dom-translate';

describe('central locale behavior', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('English fallback is deterministic when the chosen dictionary lacks a key', () => {
    expect(labelFor({}, '스토어', { '스토어': 'Store' })).toBe('Store');
  });
  it('app translation works inside native-translation-protected Korean containers', async () => {
    document.body.innerHTML = '<section lang="ko" translate="no" class="notranslate" data-no-translate><span>스토어</span><span data-i18n-skip>김두현</span></section>';
    await loadDictionary('en');
    await applyDomTranslation('en');
    expect(document.querySelector('span')?.textContent).toBe('Store');
    expect(document.querySelector('[data-i18n-skip]')?.textContent).toBe('김두현');
  });
  it('language changes replace previous labels rather than translating the previous output', async () => {
    document.body.innerHTML = '<span>스토어</span>';
    await loadDictionary('en'); await applyDomTranslation('en');
    expect(document.querySelector('span')?.textContent).toBe('Store');
    await loadDictionary('ko'); await applyDomTranslation('ko');
    expect(document.querySelector('span')?.textContent).toBe('스토어');
    setActiveLang('en');
    expect(tx('스토어')).toBe('Store');
  });
  it('missing seller translation keeps original specifications and units', () => {
    const specs = { movement: '셀러 원문', caseSize: '40 mm' };
    expect(mergeSpecs(specs, undefined)).toEqual(specs);
    expect(mergeSpecs(specs, { movement: 'Automatic' })).toEqual({ movement: 'Automatic', caseSize: '40 mm' });
  });
});