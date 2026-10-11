export type ShippingInput = { recipient: string; phone: string; line1: string; line2: string; city: string; state: string; postal: string; country: string };

export function normalizeShipping(s: ShippingInput): ShippingInput {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.trim().replace(/\s+/g, ' ')])) as ShippingInput;
}

/** Returns a Korean error message, or '' when every required field is valid. */
export function shippingError(raw: ShippingInput) {
  const s = normalizeShipping(raw);
  if ((Object.keys(s) as (keyof ShippingInput)[]).some(k => !s[k])) return '모든 배송 정보를 입력해 주세요.';
  if (s.recipient.length < 2) return '수령인 실명을 입력해 주세요.';
  const digits = s.phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()-]+$/.test(s.phone) || digits.length < 7 || digits.length > 15) return '택배 수령 가능한 실제 전화번호를 입력해 주세요.';
  if (!/^[A-Za-z0-9 -]{3,12}$/.test(s.postal)) return '우편번호 형식을 확인해 주세요.';
  return '';
}
