import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { getFeedPopularity } from './feed-popularity.functions';
import { loadSeen, type SeenMap } from './seen-history';
import { sellerKey } from './seller-directory';
import type { FeedSignals } from './personal-feed';

const EMPTY: ReadonlySet<string> = new Set();

/** Per-tab-session random seed: the order stays put while browsing, and is reshuffled in a new session. */
function sessionSeed(): string {
  try { let v = sessionStorage.getItem('vela.feedseed'); if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('vela.feedseed', v); } return v; } catch { return 'fixed'; }
}

/**
 * Everything the Home order needs to know about this visitor. Returns null on the server and on the very first
 * browser render (so the page hydrates identically), then the real signals right after.
 */
export function useFeedSignals(userId: string | null, saved: readonly string[], followed: readonly string[]): { signals: FeedSignals; version: string } | null {
  const [boot, setBoot] = useState<{ seed: string; seen: SeenMap } | null>(null);
  useEffect(() => { setBoot({ seed: sessionSeed(), seen: loadSeen() }); }, []);
  const popularityFn = useServerFn(getFeedPopularity);
  const popularity = useQuery({ queryKey: ['feed-popularity'], queryFn: () => popularityFn(), staleTime: 10 * 60_000, retry: false });
  const likes = useQuery({
    queryKey: ['my-likes', userId ?? undefined], enabled: Boolean(userId), staleTime: 60_000,
    queryFn: async () => { const { data, error } = await supabase.from('likes').select('post_id').eq('user_id', userId!); if (error) throw error; return data ?? []; },
  });
  const likeKey = (likes.data ?? []).map(r => r.post_id).join(','), savedKey = saved.join(','), followKey = followed.join(',');
  const popKey = popularity.dataUpdatedAt;
  return useMemo(() => {
    if (!boot) return null;
    const signals: FeedSignals = {
      now: Date.now(), seed: boot.seed, userId, seen: boot.seen,
      likedIds: likeKey ? new Set(likeKey.split(',')) : EMPTY,
      savedIds: savedKey ? new Set(savedKey.split(',')) : EMPTY,
      followedSellers: new Set(followKey ? followKey.split(',').map(sellerKey) : []),
      popularity: popularity.data ?? {},
    };
    return { signals, version: [boot.seed, userId ?? '', likeKey, savedKey, followKey, popKey].join('|') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot, userId, likeKey, savedKey, followKey, popKey]);
}
