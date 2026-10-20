import { createBatchLoader } from './batch-loader';
import { getSellerAvatar, getSellerAvatars } from './market.functions';

type Key = { storeId?: string | undefined; userId?: string | undefined };
type Result = { avatar: string | null };

/** Every feed card asks for its seller photo at once; one request answers all of them. */
const loader = createBatchLoader<Key, Result>(async keys => {
  try {
    const res = await getSellerAvatars({ data: { items: keys } });
    if (Array.isArray(res) && res.length === keys.length) return res;
  } catch { /* fall back to one-by-one below */ }
  return Promise.all(keys.map(k => getSellerAvatar({ data: k }).catch((): Result => ({ avatar: null }))));
});

/** Same call shape as getSellerAvatar({ data }), but batched. */
export const loadSellerAvatar = ({ data }: { data: Key }): Promise<Result> => loader({ storeId: data.storeId, userId: data.userId });
