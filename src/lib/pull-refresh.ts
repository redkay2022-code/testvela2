export const REFRESH_PULL_THRESHOLD = 72;
export function refreshPullDistance(dx: number, dy: number): number {
  return dy > 0 && dy > Math.abs(dx) ? Math.min(110, dy * 0.5) : 0;
}
export const shouldRefreshPull = (distance: number) => distance >= REFRESH_PULL_THRESHOLD;