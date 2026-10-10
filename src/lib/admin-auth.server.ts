/** Server-only helpers shared by admin server functions. */
export async function assertAdminRole(supabase: any, userId: string) {
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (!data) throw new Error('Forbidden');
}

const failures = new Map<string, { n: number; until: number }>();

/** Re-checks the signed-in admin's own password with a throwaway client (nothing is stored). Slows brute force. */
export async function checkAdminPassword(supabase: any, userId: string, password: string) {
  await assertAdminRole(supabase, userId);
  const f = failures.get(userId);
  if (f && f.n >= 5 && Date.now() < f.until) throw new Error('비밀번호를 여러 번 틀렸습니다. 10분 뒤에 다시 시도해 주세요.');
  const { data: u } = await supabase.auth.getUser();
  const email = u?.user?.email;
  if (!email) throw new Error('계정 정보를 확인할 수 없습니다.');
  const { createClient } = await import('@supabase/supabase-js');
  const key = (process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_ANON_KEY'])!;
  const probe = createClient(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const n = (f && Date.now() < f.until ? f.n : 0) + 1;
    failures.set(userId, { n, until: Date.now() + 10 * 60_000 });
    throw new Error('비밀번호가 올바르지 않습니다.');
  }
  failures.delete(userId);
}
