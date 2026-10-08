import { describe, expect, it } from 'vitest';
import { refreshPullDistance, shouldRefreshPull } from '@/lib/pull-refresh';
describe('pull-to-refresh gesture', () => {
  it('refreshes only after a deliberate downward pull', () => {
    expect(shouldRefreshPull(refreshPullDistance(0, 150))).toBe(true);
    expect(shouldRefreshPull(refreshPullDistance(0, 100))).toBe(false);
  });
  it('preserves horizontal swipes and upward scrolling', () => {
    expect(refreshPullDistance(200, 150)).toBe(0);
    expect(refreshPullDistance(0, -150)).toBe(0);
  });
});