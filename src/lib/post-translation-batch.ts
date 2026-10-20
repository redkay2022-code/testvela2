import { createBatchLoader } from './batch-loader';
import { getPostTranslation, getStoredPostTranslations } from './translate.functions';
import type { PostTranslation } from './post-translation';

type Key = { id: string; lang: string };

/**
 * Feed cards ask for their translated text at once. Already-saved translations come back in ONE request;
 * only a post that has no saved translation yet is translated on its own (as before).
 */
const loader = createBatchLoader<Key, PostTranslation | null>(async keys => {
  const stored = new Map<string, Record<string, PostTranslation | null>>();
  await Promise.all([...new Set(keys.map(k => k.lang))].map(async lang => {
    try { stored.set(lang, await getStoredPostTranslations({ data: { postIds: keys.filter(k => k.lang === lang).map(k => k.id), lang } })); } catch { /* per-post fallback below */ }
  }));
  return Promise.all(keys.map(async k => stored.get(k.lang)?.[k.id] ?? getPostTranslation({ data: { postId: k.id, lang: k.lang } })));
});

export const loadPostTranslation = (id: string, lang: string): Promise<PostTranslation | null> => loader({ id, lang });
