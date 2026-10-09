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
