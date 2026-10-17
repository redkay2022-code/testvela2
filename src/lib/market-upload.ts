import { supabase } from '@/integrations/supabase/client';
import { removeMarketMedia, signMarketUploads } from '@/lib/proxy-seller.functions';
import { isExternalVideo } from '@/lib/mux';

const BUCKET = 'market-media';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

type PutOptions = { contentType?: string; cacheControl?: string };

/**
 * 상품 사진·영상을 올린다. 경로의 첫 폴더가 내 계정이면 그대로 올리고,
 * 다른 회원(관리자의 대리 셀러) 폴더이면 서버가 만들어 준 1회용 토큰으로 올린다.
 * 그래서 대리 셀러의 상품 파일도 항상 "그 셀러의 폴더"에 저장되고, 피드에서 정상적으로 보인다.
 */
export async function putMarketMedia(path: string, body: Blob, options: PutOptions = {}): Promise<{ error: unknown }> {
  const uid = await currentUserId();
  if (!uid || path.split('/')[0] === uid) return supabase.storage.from(BUCKET).upload(path, body, options);
  try {
    const { tokens } = await signMarketUploads({ data: { paths: [path] } });
    const token = tokens[path];
    if (!token) return { error: new Error('no token') };
    const contentType = options.contentType ?? (body.type || undefined);
    const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, body, { ...(contentType ? { contentType } : {}), ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}) });
    return { error };
  } catch (error) { return { error }; }
}

/** 올리다 실패했을 때 지우기. 내 폴더 파일은 직접, 다른 회원 폴더 파일은 관리자 권한으로 서버가 지운다. */
export async function removeMarketFiles(input: string[]): Promise<void> {
  const paths = input.filter(p => !isExternalVideo(p));
  if (!paths.length) return;
  const uid = await currentUserId();
  const own = paths.filter(p => !uid || p.split('/')[0] === uid);
  const others = paths.filter(p => !own.includes(p));
  if (own.length) await supabase.storage.from(BUCKET).remove(own).catch(() => undefined);
  if (others.length) await removeMarketMedia({ data: { paths: others } }).catch(() => undefined);
}
