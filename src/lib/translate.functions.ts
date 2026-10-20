import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { langNames, translateBatch } from './translate.server';
import { translatableSpecKeys, type PostTranslation } from './post-translation';

const cache = new Map<string, string>();
const langEnum = z.enum(Object.keys(langNames) as [string, ...string[]]);

/** Machine-translates user/seller-written snippets into the target language; returns originals on failure. */
export const translateTexts = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ lang: langEnum, texts: z.array(z.string().min(1).max(3000)).min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const out: string[] = data.texts.map((t) => cache.get(`${data.lang}\u0000${t}`) ?? '');
    const todo = data.texts.map((t, i) => ({ t, i })).filter(({ i }) => !out[i]);
    if (todo.length) {
      const res = await translateBatch(data.lang, todo.map((x) => x.t));
      if (res) todo.forEach(({ t, i }, k) => { out[i] = res[k]!; cache.set(`${data.lang}\u0000${t}`, res[k]!); });
    }
    return data.texts.map((t, i) => out[i] || t);
  });

/** Returns the seller's post text translated into `lang`, cached on the post row (cache resets when the seller edits). */
export const getPostTranslation = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ postId: z.string().min(1).max(80), lang: langEnum }).parse(d))
  .handler(async ({ data }): Promise<PostTranslation | null> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: post } = await supabaseAdmin.from('posts').select('id,title,description,specs,source_lang,translations,status').eq('id', data.postId).maybeSingle();
    if (!post || post.status !== 'published' || post.source_lang === data.lang) return null;
    const all = (post.translations && typeof post.translations === 'object' ? post.translations : {}) as Record<string, PostTranslation>;
    if (all[data.lang]) return all[data.lang]!;
    const specs = (post.specs && typeof post.specs === 'object' && !Array.isArray(post.specs) ? post.specs : {}) as Record<string, unknown>;
    const keys = translatableSpecKeys.filter((k) => typeof specs[k] === 'string' && (specs[k] as string).trim());
    const texts = [post.title, post.description, ...keys.map((k) => specs[k] as string)].map((s) => s || ' ');
    const res = await translateBatch(data.lang, texts);
    if (!res) return null;
    const result: PostTranslation = { title: res[0]!.trim(), description: res[1]!.trim(), specs: Object.fromEntries(keys.map((k, i) => [k, res[i + 2]!])) };
    await supabaseAdmin.from('posts').update({ translations: { ...all, [data.lang]: result } }).eq('id', post.id);
    return result;
  });

/** Saved translations for many posts in one request (feed cards). A post with no saved translation yet comes back as null. */
export const getStoredPostTranslations = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ postIds: z.array(z.string().min(1).max(80)).min(1).max(60), lang: langEnum }).parse(d))
  .handler(async ({ data }): Promise<Record<string, PostTranslation | null>> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows } = await supabaseAdmin.from('posts').select('id,source_lang,translations,status').in('id', data.postIds);
    const out: Record<string, PostTranslation | null> = Object.fromEntries(data.postIds.map(id => [id, null]));
    for (const post of rows ?? []) {
      if (post.status !== 'published' || post.source_lang === data.lang) continue;
      const all = (post.translations && typeof post.translations === 'object' ? post.translations : {}) as Record<string, PostTranslation>;
      if (all[data.lang]) out[post.id] = all[data.lang]!;
    }
    return out;
  });
