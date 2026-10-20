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
  if (error && /banned/i.test(error.message)) throw new Error('This account has been permanently suspended.');
  if (error || !data.session) throw new Error('Check your phone number and password.');
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

const creds = z.object({ phone: z.string().max(30), password: z.string().min(8).max(72), captchaToken: z.string().min(1).max(4096) });

// Cloudflare Turnstile: the token is single-use, so it is verified once, before any hashing or database work.
export async function verifyTurnstile(token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const secret = process.env['TURNSTILE_SECRET_KEY'];
  if (!secret) throw new Error('Sign-in is temporarily unavailable.');
  let ok = false;
  try {
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });
    const json = (await res.json()) as { success?: boolean };
    ok = res.ok && json.success === true;
  } catch {
    throw new Error('Could not connect. Please try again.');
  }
  if (!ok) throw new Error('Verification failed. Please try again.');
}

export const signUpWithPhone = createServerFn({ method: 'POST' })
  .inputValidator(d => creds.extend({ nickname: z.string().trim().min(1).max(30) }).parse(d))
  .handler(async ({ data }) => {
    await verifyTurnstile(data.captchaToken);
    const hash = await hashPhone(normalizePhone(data.phone));
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: existing } = await supabaseAdmin.from('profiles').select('user_id').eq('phone_hash', hash).maybeSingle();
    if (existing) throw new Error('An account already exists with this phone number.');
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: authEmail(hash), password: data.password, email_confirm: true });
    if (error || !created.user) throw new Error(/already/i.test(error?.message ?? '') ? 'An account already exists with this phone number.' : /weak|pwned|password/i.test(error?.message ?? '') ? 'This password is too common. Please choose a stronger one.' : 'Could not create your account. Please try again.');
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
  .handler(async ({ data }) => {
    await verifyTurnstile(data.captchaToken);
    return passwordSession(authEmail(await hashPhone(normalizePhone(data.phone))), data.password);
  });
