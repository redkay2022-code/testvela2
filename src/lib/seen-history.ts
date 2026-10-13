/**
 * What this visitor has opened and how long they stayed, kept ONLY in their own browser (localStorage).
 * Nothing here is sent to the server. The feed uses it to move already-seen products back and to learn
 * which kinds of products this person spends time on.
 */
const KEY = 'vela.seen.v1', MAX_ENTRIES = 300, MAX_DWELL_MS = 10 * 60_000;
export type Seen = { n: number; ms: number; at: number };
export type SeenMap = Record<string, Seen>;

export function loadSeen(): SeenMap {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: SeenMap = {};
    for (const [id, v] of Object.entries(raw as Record<string, Partial<Seen>>)) {
      if (v && typeof v.n === 'number' && typeof v.ms === 'number' && typeof v.at === 'number') out[id] = { n: v.n, ms: v.ms, at: v.at };
    }
    return out;
  } catch { return {}; }
}

function save(map: SeenMap) {
  try {
    const ids = Object.keys(map);
    if (ids.length > MAX_ENTRIES) { ids.sort((a, b) => (map[a]?.at ?? 0) - (map[b]?.at ?? 0)); for (const id of ids.slice(0, ids.length - MAX_ENTRIES)) delete map[id]; }
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* storage full or blocked: ranking simply has less to go on */ }
}

/** Call when a product page / short is opened. */
export function recordOpen(id: string, now = Date.now()) {
  if (!id) return;
  const map = loadSeen(), cur = map[id];
  map[id] = { n: (cur?.n ?? 0) + 1, ms: cur?.ms ?? 0, at: now };
  save(map);
}

/** Call with the time (ms) spent on a product page / short when the visitor leaves it. Glances under 1 s are ignored. */
export function addDwell(id: string, ms: number, now = Date.now()) {
  if (!id || !Number.isFinite(ms) || ms < 1000) return;
  const map = loadSeen(), cur = map[id];
  map[id] = { n: cur?.n ?? 1, ms: (cur?.ms ?? 0) + Math.min(ms, MAX_DWELL_MS), at: cur?.at ?? now };
  save(map);
}
