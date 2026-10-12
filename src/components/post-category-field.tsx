import { postCategoryLabels } from '@/lib/feed-categories';

/** Required menu-category choice shared by every upload/edit form (saved in specs.menuCategory, shown under the matching top menu on the main feed): tap to pick exactly one. */
export function PostCategoryField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return <div className="notranslate mt-4" translate="no">
    <label htmlFor="post-menu-category" className="form-label">메뉴 카테고리 <span aria-hidden="true" className="text-destructive">*</span></label>
    <select id="post-menu-category" className="form-input notranslate" translate="no" required aria-required="true" value={value} onChange={e => onChange(e.target.value)}>
      <option value="" disabled>메뉴 카테고리 선택 (필수)</option>
      {postCategoryLabels.map(c => <option key={c} value={c} translate="no" className="notranslate">{c}</option>)}
    </select>
  </div>;
}
