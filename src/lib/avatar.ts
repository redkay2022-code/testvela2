import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const AVATAR_BUCKET = 'avatars';
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Upload (or replace) the signed-in user's avatar and store the path on their profile. */
export async function uploadAvatar(userId: string, file: File) {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 선택할 수 있어요.');
  if (file.size > MAX_AVATAR_BYTES) throw new Error('사진은 5MB 이하로 선택해 주세요.');
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.');
  const { error: pErr } = await supabase.from('profiles').update({ avatar_url: path }).eq('user_id', userId);
  if (pErr) throw new Error('프로필을 저장하지 못했어요. 다시 시도해 주세요.');
  return path;
}

/** Private bucket: resolve a short-lived signed URL for display. */
export function useAvatarUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return;
    void supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
      if (alive) setUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [path]);
  return url;
}
