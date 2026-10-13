/**
 * Optional load-time measurement. Silent by default. Open the site with ?perf=1 (or run
 * localStorage.setItem('vela.perf','1') once) and read the "[vela-perf]" lines in the browser console:
 * first paint, largest paint (LCP), and how long the feed data took to arrive.
 */
let enabled: boolean | null = null;
export function perfEnabled() {
  if (enabled !== null) return enabled;
  if (typeof window === 'undefined') return false;
  try { enabled = /[?&]perf=1/.test(window.location.search) || window.localStorage.getItem('vela.perf') === '1'; } catch { enabled = false; }
  return enabled;
}
export function perfLog(label: string, ms: number) { if (perfEnabled()) console.info(`[vela-perf] ${label}: ${Math.round(ms)} ms`); }
export function initPerf() {
  if (!perfEnabled() || typeof PerformanceObserver === 'undefined') return;
  const watch = (type: string, onEntry: (e: PerformanceEntry) => void) => {
    try { new PerformanceObserver(list => list.getEntries().forEach(onEntry)).observe({ type, buffered: true }); } catch { /* unsupported entry type */ }
  };
  watch('paint', e => perfLog(e.name, e.startTime));
  watch('largest-contentful-paint', e => perfLog('largest-contentful-paint', e.startTime));
  watch('longtask', e => { if (e.duration > 120) perfLog('long task (page froze)', e.duration); });
}
