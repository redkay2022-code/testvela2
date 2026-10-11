import { TriangleAlert } from 'lucide-react';

export const factoryOptions = [
  'VS Factory (VSF)', 'ZF Factory (ZF)', '3K Factory (3KF)', 'PPF Factory (PPF)', 'APS Factory (APSF)', 'ARF Factory (ARF)',
  'GMF Factory (GMF)', 'BV Factory (BVF)', 'V7 Factory (V7F)', 'RC Factory', 'RG Factory', 'UMI Factory', 'Rich Factory',
];
export type SourceType = 'custom' | 'factory' | 'other';

/** Source & Factory selector with the false-labelling warning, shared by every listing form. */
export function SourceFactoryField({ sourceType, factory, onChange }: { sourceType: SourceType; factory: string; onChange: (t: SourceType, f: string) => void }) {
  return <div className="mt-1">
    <div className="form-label">제조 / 출처 구분 (Source & Factory)</div>
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3" role="note">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-relaxed text-destructive">⚠️ [경고] 허위 공장 표기 또는 출처 정보 도용 적발 시, 예고 없이 상품 삭제 및 셀러 자격이 영구 박탈될 수 있으며 에스크로 정산이 동결 조치됩니다.</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Listing false factory information will result in immediate seller ban and escrow freeze.</p>
      </div>
    </div>
    <div role="radiogroup" aria-label="제조 / 출처 구분 (Source & Factory)" className="mt-3 grid grid-cols-3 gap-2">
      {([['custom', '커스텀 제작'], ['factory', '공장 선택'], ['other', '기타 - 직접입력']] as const).map(([value, label]) => (
        <label key={value} className={`flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-center text-xs font-medium transition-colors ${sourceType === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
          <input type="radio" name="sourceType" className="sr-only" checked={sourceType === value} onChange={() => onChange(value, '')} />
          {label}
        </label>
      ))}
    </div>
    {sourceType === 'factory' && <select aria-label="공장 선택" className="form-input mt-2" value={factory} onChange={e => onChange('factory', e.target.value)}><option value="">공장을 선택해 주세요</option>{factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}</select>}
    {sourceType === 'other' && <input aria-label="출처 직접 입력" className="form-input mt-2" placeholder="출처 / 공장을 직접 입력해 주세요" maxLength={80} value={factory} onChange={e => onChange('other', e.target.value)} />}
  </div>;
}
