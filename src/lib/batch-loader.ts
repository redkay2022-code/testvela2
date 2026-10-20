/**
 * Collects many small lookups made in the same moment (for example one avatar per feed card) and sends
 * them as ONE request. Identical keys in a batch are asked once. `run` must return one value per key, in order.
 */
export function createBatchLoader<K, V>(
  run: (keys: K[]) => Promise<V[]>,
  { wait = 20, max = 50, keyOf = (k: K) => JSON.stringify(k) }: { wait?: number; max?: number; keyOf?: (key: K) => string } = {},
): (key: K) => Promise<V> {
  type Pending = { key: K; resolve: (value: V) => void; reject: (error: unknown) => void };
  let queue: Pending[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    const batch = queue;
    queue = [];
    if (!batch.length) return;
    const unique = new Map<string, K>();
    for (const p of batch) { const id = keyOf(p.key); if (!unique.has(id)) unique.set(id, p.key); }
    const ids = [...unique.keys()];
    run([...unique.values()]).then(
      values => {
        const byId = new Map(ids.map((id, i) => [id, values[i] as V]));
        for (const p of batch) p.resolve(byId.get(keyOf(p.key)) as V);
      },
      error => { for (const p of batch) p.reject(error); },
    );
  };

  return key => new Promise<V>((resolve, reject) => {
    queue.push({ key, resolve, reject });
    if (queue.length >= max) flush();
    else timer ??= setTimeout(flush, wait);
  });
}
