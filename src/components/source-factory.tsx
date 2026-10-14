import { TriangleAlert } from 'lucide-react';

export const factoryOptions = [
  'VS Factory (VSF)', 'ZF Factory (ZF)', '3K Factory (3KF)', 'PPF Factory (PPF)', 'APS Factory (APSF)', 'ARF Factory (ARF)',
  'GMF Factory (GMF)', 'BV Factory (BVF)', 'V7 Factory (V7F)', 'RC Factory', 'RG Factory', 'UMI Factory', 'Rich Factory',
];
export type SourceType = 'custom' | 'factory' | 'other';

/** 허위 공장 표기 경고 문구 (선택칸은 source-factory-select.tsx 의 드롭다운으로 방수 칸 오른쪽에 놓인다). */
export function SourceFactoryField() {
  return <div className="mt-1">
    <div className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3" role="note">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-relaxed text-destructive">⚠️ [경고] 허위 공장 표기 또는 출처 정보 도용 적발 시, 예고 없이 상품 삭제 및 셀러 자격이 영구 박탈될 수 있으며 에스크로 정산이 동결 조치됩니다.</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Listing false factory information will result in immediate seller ban and escrow freeze.</p>
      </div>
    </div>
  </div>;
}
