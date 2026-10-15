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
