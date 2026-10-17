import { LOUNGE_MENU_LABEL, uploadCategoryLabels } from '@/lib/feed-categories';
import { tx } from '@/lib/dom-translate';
import { Tx } from './tx';

/** Required menu-category choice shared by every upload/edit form (saved in specs.menuCategory, shown under the matching top menu on the main feed): tap to pick exactly one. */
export function PostCategoryField({ value, onChange, allowLounge = true }: { value: string; onChange: (next: string) => void; allowLounge?: boolean }) {
  return <div className="notranslate mt-4" translate="no" data-no-translate="">
    <label htmlFor="post-menu-category" className="form-label"><Tx>메뉴 카테고리</Tx> <span aria-hidden="true" className="text-destructive">*</span></label>
    <select id="post-menu-category" className="form-input notranslate" translate="no" required aria-required="true" value={value} onChange={e => onChange(e.target.value)}>
      <option value="" disabled>{tx('메뉴 카테고리 선택 (필수)')}</option>
      {uploadCategoryLabels.filter(c => allowLounge || c !== LOUNGE_MENU_LABEL).map(c => <option key={c} value={c} translate="no" className="notranslate">{tx(c)}</option>)}
    </select>
  </div>;
}
