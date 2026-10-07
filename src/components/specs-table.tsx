const specLabels: Record<string, string> = {
  brand: '브랜드',
  model: '모델',
  movement: '무브먼트',
  caseSize: '케이스 크기',
  material: '소재',
  waterResistance: '방수',
};

function labelFor(key: string) {
  return specLabels[key] ?? key;
}

/** 공통 사양 표: seller-listings에서 저장한 specs(jsonb)를 라벨/값 2열 표로 렌더링한다.
 *  값이 하나도 없으면 fallback(에디토리ial 샘플용 기본 사양)을 대신 렌더링한다. */
export function SpecsTable({specs, fallback}: {specs: unknown; fallback?: React.ReactNode}) {
  let entries: [string, string][] = [];
  if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
    entries = Object.entries(specs as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && v.trim())
      .map(([k, v]) => [k, (v as string).trim().slice(0, 80)]);
  }
  if (!entries.length) return <>{fallback ?? null}</>;
  return (
    <div className="mt-5">
      <h3 className="mb-1 text-sm font-semibold">상품 사양</h3>
      <dl className="lux-specs">
        {entries.map(([key, value]) => (
          <div key={key}><dt>{labelFor(key)}</dt><dd style={{overflowWrap: 'anywhere'}}>{value}</dd></div>
        ))}
      </dl>
    </div>
  );
}
