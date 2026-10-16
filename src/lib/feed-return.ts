import type { marketSearch } from './market';

/**
 * Remembers which feed (category, tab, filters) the visitor was looking at, so the back arrow on a product / video
 * brings them back to that same category instead of the plain Home screen.
 */
type MarketSearch = ReturnType<typeof marketSearch.parse>;
const KEYS = ['feedCategory', 'tab', 'fq', 'ffactory', 'fmin', 'fmax', 'fshorts', 'fsort'] as const;
const STORE = 'vela.feed-return';
let last: Partial<MarketSearch> | null = null;

export function rememberFeed(search: Partial<MarketSearch>): void {
  const keep: Record<string, unknown> = {};
  for (const key of KEYS) if (search[key] !== undefined) keep[key] = search[key];
  last = keep as Partial<MarketSearch>;
  try { sessionStorage.setItem(STORE, JSON.stringify(keep)); } catch { /* storage blocked */ }
}

/** The last feed view, ready to be used as the `search` of a navigation to "/". */
export function feedReturnSearch(): Partial<MarketSearch> {
  if (last) return last;
  try { const raw = sessionStorage.getItem(STORE); if (raw) { last = JSON.parse(raw) as Partial<MarketSearch>; return last; } } catch { /* storage blocked */ }
  return {};
}

/** True when this tab has an earlier page of the app to go back to (not just a freshly opened link). */
export function canGoBackInApp(): boolean {
  try {
    const state = window.history.state as Record<string, unknown> | null;
    const index = state?.['__TSR_index'];
    return typeof index === 'number' && index > 0;
  } catch { return false; }
}
