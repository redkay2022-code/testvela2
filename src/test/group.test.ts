import { describe, expect, it } from 'vitest';
import { clampGroupHours, clampGroupSize, groupTier, isGroupId, timeLeft } from '@/lib/group';

describe('group purchase rules', () => {
  it('maps member count to the reward tier', () => {
    expect(groupTier(1)).toEqual({ participant: 0, leader: 0, welcome: false });
    expect(groupTier(2)).toEqual({ participant: 2, leader: 1, welcome: false });
    expect(groupTier(3)).toEqual({ participant: 2, leader: 1, welcome: false });
    expect(groupTier(4)).toEqual({ participant: 4, leader: 2, welcome: false });
    expect(groupTier(6)).toEqual({ participant: 4, leader: 2, welcome: false });
    expect(groupTier(7)).toEqual({ participant: 6, leader: 3, welcome: false });
    expect(groupTier(9)).toEqual({ participant: 6, leader: 3, welcome: false });
    expect(groupTier(10)).toEqual({ participant: 8, leader: 5, welcome: true });
  });
  it('clamps creator input to 2-10 people and 1-72 hours', () => {
    expect(clampGroupSize(1)).toBe(2); expect(clampGroupSize(99)).toBe(10); expect(clampGroupSize(5.7)).toBe(5);
    expect(clampGroupHours(0)).toBe(1); expect(clampGroupHours(500)).toBe(72); expect(clampGroupHours(Number.NaN)).toBe(48);
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
});
