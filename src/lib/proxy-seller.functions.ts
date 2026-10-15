import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * 관리자 전용: 로그인 없이 "대신 등록"에만 쓰는 셀러 계정을 만든다.
 * 비밀번호·전화번호가 없는 계정이라 아무도 로그인할 수 없고, 승인된 셀러(seller 권한)로 바로 등록된다.
 */
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (!data) throw new Error('Forbidden');
}

const randomCode = () => 'VELA_' + Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

export const createProxySellers = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ nicknames: z.array(z.string().trim().min(1).max(30)).min(1).max(10) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const created: { user_id: string; nickname: string; system_code: string }[] = [];
    const failed: string[] = [];
    for (const nickname of data.nicknames) {
      const key = crypto.randomUUID();
      let userId = '';
      try {
        const { data: made, error } = await supabaseAdmin.auth.admin.createUser({ email: `proxy-${key}@proxy.velamarket.app`, email_confirm: true });
        if (error || !made.user) throw new Error('auth');
        userId = made.user.id;
        let code = '';
        let saved = false;
        for (let i = 0; i < 5 && !saved; i++) {
          code = randomCode();
          const { error: profileError } = await supabaseAdmin.from('profiles').insert({ user_id: userId, phone_hash: `proxy:${key}`, system_code: code, nickname });
          if (!profileError) saved = true;
          else if (profileError.code !== '23505') break;
        }
        if (!saved) throw new Error('profile');
        const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({ user_id: userId, role: 'seller' }, { onConflict: 'user_id,role', ignoreDuplicates: true });
        if (roleError) throw new Error('role');
        await supabaseAdmin.from('seller_applications').upsert({ user_id: userId, system_code: code, nickname, studio_name: nickname, region: '', bio: '', wechat_id: '', wechat_nickname: '', wechat_avatar: null, wechat_phone: null, status: 'approved', reviewed_at: new Date().toISOString() }, { onConflict: 'user_id' });
        created.push({ user_id: userId, nickname, system_code: code });
      } catch {
        if (userId) await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
        failed.push(nickname);
      }
    }
    return { created, failed };
  });

/** 관리자가 다른 회원의 상품을 지우거나 고칠 때, 그 회원 폴더에 있는 사진·영상 파일도 함께 정리한다. */
export const removeMarketMedia = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ paths: z.array(z.string().min(1).max(300)).min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const paths = data.paths.filter(p => !p.startsWith('http') && !p.includes('..'));
    if (paths.length) await supabaseAdmin.storage.from('market-media').remove(paths);
    return { ok: true };
  });

const idSchema = z.string().uuid();
const AVATAR_BUCKET = 'avatars';

/** 관리자가 고른 셀러의 프로필(닉네임·시스템 코드·사진)을 읽는다. 사진은 잠깐 쓰는 서명 주소로 돌려준다. */
export const getProxyProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: idSchema }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: profile } = await supabaseAdmin.from('profiles').select('nickname,system_code,avatar_url').eq('user_id', data.userId).maybeSingle();
    if (!profile) throw new Error('Not found');
    let avatarUrl: string | null = null;
    if (profile.avatar_url) {
      const { data: signed } = await supabaseAdmin.storage.from(AVATAR_BUCKET).createSignedUrl(profile.avatar_url, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }
    return { nickname: profile.nickname as string, systemCode: profile.system_code as string, avatarUrl };
  });

/** 닉네임 변경 + 그 셀러의 기존 상품에 복사돼 있는 표시 이름도 함께 맞춘다. */
export const updateProxyNickname = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: idSchema, nickname: z.string().trim().min(1).max(30) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('profiles').update({ nickname: data.nickname }).eq('user_id', data.userId);
    if (error) throw new Error('Nickname could not be saved.');
    await supabaseAdmin.from('seller_applications').update({ nickname: data.nickname }).eq('user_id', data.userId);
    await supabaseAdmin.from('posts').update({ creator: data.nickname.slice(0, 40) }).eq('user_id', data.userId).is('store_id', null);
    return { ok: true };
  });

/** 1단계: 사진을 직접 올릴 수 있는 1회용 주소를 만든다(기존 사진은 지운다). */
export const signProxyAvatarUpload = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: idSchema, ext: z.enum(['jpg', 'jpeg', 'png', 'webp']) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: profile } = await supabaseAdmin.from('profiles').select('avatar_url').eq('user_id', data.userId).maybeSingle();
    if (!profile) throw new Error('Not found');
    const path = `${data.userId}/avatar.${data.ext}`;
    await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([path, ...(profile.avatar_url ? [profile.avatar_url as string] : [])]);
    const { data: signed, error } = await supabaseAdmin.storage.from(AVATAR_BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error('Could not prepare upload.');
    return { path, token: signed.token };
  });

/** 2단계: 올린 사진을 프로필 사진으로 지정한다. */
export const setProxyAvatar = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: idSchema, path: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!data.path.startsWith(`${data.userId}/`) || data.path.includes('..')) throw new Error('Invalid path');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('profiles').update({ avatar_url: data.path }).eq('user_id', data.userId);
    if (error) throw new Error('Profile could not be saved.');
    return { ok: true };
  });

/**
 * 관리자가 다른 회원(대리 셀러) 폴더에 사진·영상을 올릴 수 있도록, 그 폴더 안의 새 파일 경로마다 1회용 업로드 토큰을 만든다.
 * 스토리지 정책상 본인 폴더 밖에는 직접 올릴 수 없어서 서버가 대신 허락해 주는 방식이다.
 */
export const signMarketUploads = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ paths: z.array(z.string().min(3).max(200)).min(1).max(20) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const tokens: Record<string, string> = {};
    for (const path of data.paths) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,120}$/i.test(path) || path.includes('..')) throw new Error('Invalid path');
      const { data: signed, error } = await supabaseAdmin.storage.from('market-media').createSignedUploadUrl(path);
      if (error || !signed) throw new Error('Could not prepare upload.');
      tokens[path] = signed.token;
    }
    return { tokens };
  });
