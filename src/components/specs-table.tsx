import { Fragment } from 'react';
import { Tx } from './tx';

const specLabels: Record<string, string> = {
  brand: '브랜드',
  model: '모델',
  movement: '무브먼트',
  caseSize: '케이스 직경',
  material: '케이스 소재',
  waterResistance: '방수',
  glass: '글라스/크리스탈',
  factory: '출처 / 공장',
  thickness: '두께',
  weight: '무게',
  additionalDetails: '추가 내용',
};

function labelFor(key: string) {
  return specLabels[key] ?? key;
}

/** 공통 사양 표: seller-listings에서 저장한 specs(jsonb)를 라벨/값 2열 표로 렌더링한다.
 *  값이 하나도 없으면 fallback(에디토리 샘플용 기본 사양)을 대신 렌더링한다. */
const WATER_NOTICE_FACTORY = 'Factory Products: Factory water-resistance ratings are for reference purposes only. Please avoid submerging or exposing the watch to water unless it has received professional waterproofing. We do not guarantee water resistance, and water damage is ineligible for refunds, exchanges, or free repairs.';
const WATER_NOTICE_CUSTOM = 'Custom Products: For inquiries regarding the water resistance of custom-crafted timepieces, please contact the seller directly.';

export function SpecsTable({specs, fallback, category}: {specs: unknown; fallback?: React.ReactNode; category?: string}) {
  let entries: [string, string][] = [];
  if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
    entries = Object.entries(specs as Record<string, unknown>)
      .filter(([k, v]) => k !== 'sourceType' && k !== 'powerReserve' && typeof v === 'string' && v.trim())
      .map(([k, v]) => [k, (v as string).trim().slice(0, k === 'additionalDetails' ? 3000 : 80)]);
  }
  if (!entries.length) return <>{fallback ?? null}</>;
  const sourceType = specs && typeof specs === 'object' ? (specs as Record<string, unknown>)['sourceType'] : undefined;
  const isCustom = sourceType === 'custom' || (sourceType === undefined && category === '커스텀제작');
  const waterNotice = isCustom ? WATER_NOTICE_CUSTOM : WATER_NOTICE_FACTORY;
  return (
    <div className="mt-5">
      <h3 className="mb-1 text-sm font-semibold"><Tx>상품 사양</Tx></h3>
      <dl className="lux-specs notranslate" translate="no" data-no-translate>
        {entries.map(([key, value]) => (
          <Fragment key={key}>
            <div><dt><Tx>{labelFor(key)}</Tx></dt><dd data-i18n-skip className="whitespace-pre-wrap" style={{overflowWrap: 'anywhere'}}>{value}</dd></div>
            {key === 'waterResistance' && <div style={{display: 'block'}}><dd data-i18n-skip data-no-translate translate="no" className="notranslate" role="note" style={{color: '#ef4444', fontSize: 11, lineHeight: 1.55, textAlign: 'left'}}>{waterNotice}</dd></div>}
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
