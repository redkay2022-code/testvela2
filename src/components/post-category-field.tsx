import { uploadCategoryLabels } from '@/lib/feed-categories';
import { tx } from '@/lib/dom-translate';
import { Tx } from './tx';
import { isWatchStory, watchStoryOptions } from '@/lib/watch-story';
import { t } from '@/lib/i18n';
import { useCurrency } from './currency';

/** Required menu-category choice shared by every upload/edit form (saved in specs.menuCategory, shown under the matching top menu on the main feed): tap to pick exactly one. */
export function PostCategoryField({ value, onChange, subcategory, onSubcategoryChange, onTitleChange }: { value: string; onChange: (next: string) => void; subcategory: string; onSubcategoryChange: (next: string) => void; onTitleChange: (next: string) => void }) {
  useCurrency();
  return <div className="notranslate mt-4" translate="no" data-no-translate="">
    <label htmlFor="post-menu-category" className="form-label"><Tx>메뉴 카테고리</Tx> <span aria-hidden="true" className="text-destructive">*</span></label>
    <select id="post-menu-category" className="form-input notranslate" translate="no" required aria-required="true" value={value} onChange={e => onChange(e.target.value)}>
      <option value="" disabled translate="no" className="notranslate">{tx('메뉴 카테고리 선택 (필수)')}</option>
      {uploadCategoryLabels.map(c => <option key={c} value={c} translate="no" data-i18n-skip className="notranslate">{isWatchStory(c) ? t('story') : tx(c)}</option>)}
    </select>
    {isWatchStory(value) && <>
      <label htmlFor="post-story-subcategory" className="form-label" data-i18n-skip>{t('storySubcategory')} <span aria-hidden="true" className="text-destructive">*</span></label>
      <select id="post-story-subcategory" className="form-input notranslate" translate="no" data-i18n-skip required aria-required="true" value={subcategory} onChange={e => {onSubcategoryChange(e.target.value);onTitleChange(e.target.value);}}>
        <option value="" disabled translate="no" className="notranslate">{t('selectStorySubcategory')}</option>
        {watchStoryOptions.map(([, label, key]) => <option key={label} value={label} translate="no" className="notranslate">{t(key)}</option>)}
      </select>
    </>}
  </div>;
}
