import { describe, expect, it } from 'vitest';
import { DISPATCH_OPTIONS, dispatchValue, filterImmediate } from '@/lib/dispatch';

describe('dispatch time', () => {
  it('offers the six requested options', () => {
    expect(DISPATCH_OPTIONS.map(o => o.label)).toEqual(['바로 발송', '3일 이내', '5일 이내', '7일 이내', '14일 이내', '20일 이내']);
  });
  it('바로 발송 tab keeps only immediate items', () => {
    const posts = [{ source: { dispatch_time: 'immediate' } }, { source: { dispatch_time: '3d' } }, { source: null }];
    expect(filterImmediate(posts)).toHaveLength(1);
  });
});

describe('custom dispatch input', () => {
  it('stores custom text and falls back to 7d when empty', () => {
    expect(dispatchValue('custom', ' 주문 후 10일 ')).toBe('custom:주문 후 10일');
    expect(dispatchValue('custom', '  ')).toBe('7d');
  });
});
