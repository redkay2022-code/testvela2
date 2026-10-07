import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

/** Normalize to +<countrycode><digits>; spaces, dashes and brackets removed. */
function normalizePhone(raw: string) {
  const p = raw.replace(/[\s\-().]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(p)) throw new Error('Enter your phone number with country code, e.g. +86 138 0000 0000.');
  return p;
}

/** One-way peppered SHA-256. The plain number is never stored or logged. */
async function hashPhone(phone: string) {
  const pepper = process.env['PHONE_HASH_PEPPER'];
  if (!pepper) throw new Error('Sign-in is temporarily unavailable.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${pepper}:${phone}`));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

const authEmail = (hash: string) => `${hash}@phone.velamarket.app`;
const randomCode = () => 'VELA_' + Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

async function passwordSession(email: string, password: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const key = (process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_ANON_KEY'])!;
  const client = createClient(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error('Check your phone number and password.');
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

const creds = z.object({ phone: z.string().max(30), password: z.string().min(8).max(72) });

export const signUpWithPhone = createServerFn({ method: 'POST' })
  .inputValidator(d => creds.extend({ nickname: z.string().trim().min(1).max(30) }).parse(d))
  .handler(async ({ data }) => {
    const hash = await hashPhone(normalizePhone(data.phone));
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: existing } = await supabaseAdmin.from('profiles').select('user_id').eq('phone_hash', hash).maybeSingle();
    if (existing) throw new Error('An account already exists with this phone number.');
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: authEmail(hash), password: data.password, email_confirm: true });
    if (error) console.error('createUser failed', error.message);
    if (error || !created.user) throw new Error(/already/i.test(error?.message ?? '') ? 'An account already exists with this phone number.' : 'Could not create your account. ' + (error?.message ?? ''));
    let saved = false;
    for (let i = 0; i < 5 && !saved; i++) {
      const { error: pErr } = await supabaseAdmin.from('profiles').insert({ user_id: created.user.id, phone_hash: hash, system_code: randomCode(), nickname: data.nickname });
      if (!pErr) saved = true;
      else if (pErr.code === '23505' && pErr.message.includes('phone_hash')) break;
    }
    if (!saved) { await supabaseAdmin.auth.admin.deleteUser(created.user.id); throw new Error('An account already exists with this phone number.'); }
    return passwordSession(authEmail(hash), data.password);
  });

export const signInWithPhone = createServerFn({ method: 'POST' })
  .inputValidator(d => creds.parse(d))
  .handler(async ({ data }) => passwordSession(authEmail(await hashPhone(normalizePhone(data.phone))), data.password));
