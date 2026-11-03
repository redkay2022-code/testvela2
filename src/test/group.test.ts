import { describe, expect, it } from 'vitest';
import { clampGroupHours, clampGroupSize, groupDiscountPct, groupDiscountUsd, isGroupId, isInvite, normalizeInvite, timeLeft } from '@/lib/group';

describe('group purchase rules', () => {
  it('maps member count to the direct discount rate', () => {
    expect([1, 2, 3, 4, 6, 7, 9, 10].map(groupDiscountPct)).toEqual([0, 5, 5, 8, 8, 12, 12, 15]);
    expect(groupDiscountUsd(100, 8)).toBe(8);
    expect(groupDiscountUsd(33.33, 5)).toBe(1.67);
  });
  it('clamps creator input to 2-10 people and 1-72 hours', () => {
    expect(clampGroupSize(1)).toBe(2); expect(clampGroupSize(99)).toBe(10); expect(clampGroupSize(5.7)).toBe(5);
    expect(clampGroupHours(0)).toBe(1); expect(clampGroupHours(500)).toBe(72); expect(clampGroupHours(Number.NaN)).toBe(72);
  });
  it('splits the remaining time', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(timeLeft('2026-01-02T03:30:00Z', now)).toMatchObject({ days: 1, hours: 3, minutes: 30 });
    expect(timeLeft('2025-12-31T00:00:00Z', now).total).toBe(0);
  });
  it('validates group ids', () => {
    expect(isGroupId('99999999-0000-0000-0000-000000000009')).toBe(true);
    expect(isGroupId('nope')).toBe(false);
  });
  it('초대 코드/ID 판별', () => {
    expect(isInvite('VELA-K7M2')).toBe(true); expect(isInvite(' vela-k7m2 ')).toBe(true);
    expect(isInvite('99999999-0000-0000-0000-000000000009')).toBe(true);
    expect(isInvite('K7M2')).toBe(false); expect(isInvite('')).toBe(false);
    expect(normalizeInvite(' vela-k7m2 ')).toBe('VELA-K7M2');
  });
});
