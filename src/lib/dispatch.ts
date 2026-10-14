export const DISPATCH_OPTIONS = [
  { value: 'immediate', label: '바로 발송' },
  { value: '3d', label: '3일 이내' },
  { value: '5d', label: '5일 이내' },
  { value: '7d', label: '7일 이내' },
  { value: '14d', label: '14일 이내' },
  { value: '20d', label: '20일 이내' },
] as const;
export type DispatchTime = (typeof DISPATCH_OPTIONS)[number]['value'];

export const isImmediateDispatch = (post: { source?: { dispatch_time?: string | null } | null } | null | undefined) =>
  post?.source?.dispatch_time === 'immediate';

export const filterImmediate = <T extends { source?: { dispatch_time?: string | null } | null }>(posts: T[]) =>
  posts.filter(isImmediateDispatch);

/** Value saved to posts.dispatch_time; custom text is stored as "custom:<text>", empty custom falls back to 7d. */
export const dispatchValue = (choice: string, custom: string) => {
  if (choice !== 'custom') return choice;
  const text = custom.trim().slice(0, 40);
  return text ? `custom:${text}` : '7d';
};

/** 상세 화면용 표시값: 정해진 선택지는 { label }, 직접 입력한 값은 { text } 로 돌려준다. 값이 없으면 null. */
export const dispatchDisplay = (value: string | null | undefined): { label?: string; text?: string } | null => {
  if (!value) return null;
  if (value.startsWith('custom:')) { const text = value.slice(7).trim(); return text ? { text } : null; }
  const hit = DISPATCH_OPTIONS.find(option => option.value === value);
  return hit ? { label: hit.label } : null;
};
