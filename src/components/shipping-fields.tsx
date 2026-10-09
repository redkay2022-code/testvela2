import type { ShippingInput } from '@/lib/shipping';

const fields: [keyof ShippingInput, string, Record<string, unknown>, boolean?][] = [
  ['recipient', '수령인 이름 (실명)', { autoComplete: 'name', maxLength: 60 }],
  ['phone', '연락처 (택배 수령용 전화번호)', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '+82 10 1234 5678', maxLength: 24 }],
  ['line1', '도로명 주소', { autoComplete: 'address-line1' }, true],
  ['line2', '건물명 / 동·호수', { autoComplete: 'address-line2' }, true],
  ['city', '도시', { autoComplete: 'address-level2', maxLength: 60 }],
  ['state', '주 / 도', { autoComplete: 'address-level1', maxLength: 60 }],
  ['postal', '우편번호', { autoComplete: 'postal-code', maxLength: 12 }],
  ['country', '국가 / 지역', { autoComplete: 'country-name', maxLength: 60 }],
];

export function ShippingFields({ value, onChange, idPrefix = 'ship' }: { value: ShippingInput; onChange: (v: ShippingInput) => void; idPrefix?: string }) {
  return <div className="checkout-shipping">
    {fields.map(([k, label, props, wide]) => <label key={k} className={wide ? 'checkout-wide' : undefined} htmlFor={`${idPrefix}-${k}`}>{label}
      <input id={`${idPrefix}-${k}`} className="form-input" required maxLength={120} value={value[k]} onChange={e => onChange({ ...value, [k]: e.target.value })} {...props} /></label>)}
  </div>;
}
