import { postCategoryLabels } from '@/lib/feed-categories';

/** Required menu-category choice shared by every upload/edit form (saved in specs.menuCategory): official menu categories (no "전체"), exactly one checked. */
export function PostCategoryField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return <fieldset className="notranslate mt-4" translate="no" aria-required="true">
    <legend className="form-label">메뉴 카테고리 <span aria-hidden="true" className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(1개 선택)</span></legend>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="카테고리 선택">
      {postCategoryLabels.map(c => <label key={c} translate="no" className={`notranslate flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${value === c ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border text-muted-foreground'}`}>
        <input type="checkbox" className="size-4 accent-primary" name="post-category" value={c} checked={value === c} onChange={() => onChange(value === c ? '' : c)} />{c}
      </label>)}
    </div>
  </fieldset>;
}
