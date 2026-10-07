import { createServerFn } from '@tanstack/react-start';

const CODES = ['KRW', 'CNY', 'EUR', 'RUB', 'JPY', 'AED', 'SAR'] as const;
let cache: { at: number; rates: Record<string, number>; updated: string } | null = null;

/** Live USD-based exchange rates, cached for an hour. Returns null if the rate service is unreachable. */
export const getUsdRates = createServerFn({ method: 'GET' }).handler(async () => {
  if (cache && Date.now() - cache.at < 3_600_000) return { rates: cache.rates, updated: cache.updated };
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (body.result !== 'success' || !body.rates) return null;
    const rates: Record<string, number> = {};
    for (const c of CODES) { const v = body.rates[c]; if (typeof v === 'number' && v > 0) rates[c] = v; }
    cache = { at: Date.now(), rates, updated: body.time_last_update_utc ?? new Date().toUTCString() };
    return { rates, updated: cache.updated };
  } catch { return null; }
});
