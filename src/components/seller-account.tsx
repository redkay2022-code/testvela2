import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { Check, ShieldCheck, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { decideSellerApplication, getMyAccount, listSellerApplications, submitSellerApplication, updateNickname } from '@/lib/seller-accounts.functions';

export function useMyAccount(user: User | null) {
  const fn = useServerFn(getMyAccount);
  return useQuery({ queryKey: ['my-account', user?.id], queryFn: () => fn(), enabled: !!user });
}

/** Real admin toggle: only shown to accounts holding the admin role. */
export function AdminToggle({ user, role }: { user: User | null; role: string }) {
  const { data } = useMyAccount(user); const navigate = useNavigate();
  if (!data?.roles.includes('admin')) return null;
  const on = role === 'admin';
  return <label className="seller-flow-card flex items-center justify-between gap-3"><span><strong>Super Admin mode</strong><small className="block text-muted-foreground">Verified admin account</small></span>
    <input type="checkbox" role="switch" aria-label="Super Admin mode" checked={on} onChange={() => void navigate({ to: '.', search: (p: any) => ({ ...p, role: on ? 'buyer' : 'admin' }) })} className="h-5 w-9 accent-primary" /></label>;
}

/** Editable display nickname plus the anonymous system code. */
export function NicknameEditor({ user }: { user: User | null }) {
  const { data } = useMyAccount(user); const qc = useQueryClient(); const save = useServerFn(updateNickname);
  const [value, setValue] = useState(''); const [msg, setMsg] = useState('');
  useEffect(() => { if (data?.profile) setValue(data.profile.nickname); }, [data?.profile]);
  if (!data?.profile) return null;
  return <form className="seller-flow-card" onSubmit={async e => { e.preventDefault(); setMsg(''); try { await save({ data: { nickname: value } }); await qc.invalidateQueries({ queryKey: ['my-account'] }); setMsg('Saved'); } catch (err) { setMsg(err instanceof Error ? err.message : 'Could not save'); } }}>
    <span className="lux-eyebrow">ACCOUNT</span>
    <p className="mt-2 text-sm text-muted-foreground">System ID <strong className="text-foreground" data-no-translate>#{data.profile.system_code}</strong></p>
    <label className="form-label" htmlFor="nick-edit">Display nickname</label>
    <input id="nick-edit" className="form-input" required maxLength={30} value={value} onChange={e => setValue(e.target.value)} />
    <Button variant="goldOutline" size="sm" className="mt-3">Save nickname</Button>{msg && <small className="ml-3 text-muted-foreground">{msg}</small>}
  </form>;
}

export function SellerOnboarding() {
  const [user, setUser] = useState<User | null>(null); const nav = useNavigate();
  useEffect(() => { void supabase.auth.getUser().then(r => setUser(r.data.user)); }, []);
  const requestAuth = () => void nav({ to: '.', search: (p: any) => ({ ...p, panel: undefined, auth: true }) });
  const qc = useQueryClient(); const { data, isLoading } = useMyAccount(user);
  const submit = useServerFn(submitSellerApplication);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!user) return <div className="mt-5 text-center"><p className="text-sm text-muted-foreground">Sign in to apply for a seller account.</p><Button variant="gold" className="mt-4" onClick={requestAuth}>Sign in</Button></div>;
  if (isLoading || !data) return <p className="mt-5 text-sm text-muted-foreground">Loading…</p>;
  const app = data.application, prof = data.profile;
  const apply = async () => { setBusy(true); setErr(''); try { await submit(); await qc.invalidateQueries({ queryKey: ['my-account'] }); } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); } };
  return <div className="mt-5 space-y-5">
    <div className="seller-flow-card"><span className="lux-eyebrow">SELLER APPLICATION</span>
      <div className="mt-3 flex items-center gap-3"><ShieldCheck className="text-primary"/><div><strong data-no-translate>{prof?.nickname}</strong><small className="block text-muted-foreground" data-no-translate>#{prof?.system_code}</small></div></div>
      {app && app.status !== 'rejected' ? <p className="mt-4"><strong>{app.status === 'approved' ? 'Approved — welcome to Vela' : 'Pending admin review'}</strong></p>
      : <>{app?.status === 'rejected' && <p className="mt-3 text-sm text-destructive">Previous application was declined. You may reapply.</p>}
          <p className="mt-3 text-sm text-muted-foreground">No extra personal information is needed. Your account ID and nickname are sent for review.</p>
          <Button variant="gold" className="mt-4 w-full" disabled={busy} onClick={() => void apply()}>Apply for Seller Account</Button></>}
    </div>
    {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
  </div>;
}

export function AdminApplications() {
  const qc = useQueryClient(); const list = useServerFn(listSellerApplications), decide = useServerFn(decideSellerApplication);
  const { data, error } = useQuery({ queryKey: ['seller-applications'], queryFn: () => list(), retry: false });
  if (error) return <p className="text-sm text-muted-foreground">Sign in with the Super Admin account to see real applications.</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No real applications yet.</p>;
  return <div className="management-list">{data.map(a => <div className="management-row" key={a.id}><div className="studio-initial">{(a.nickname ?? '?')[0]}</div><div><strong data-no-translate>{a.nickname ?? 'Member'}</strong><small data-no-translate>#{a.system_code ?? '—'}</small></div><span className="record-status">{a.status}</span>
    {a.status === 'pending' && <div className="record-actions"><Button variant="goldOutline" size="sm" onClick={() => void decide({ data: { id: a.id, approve: true } }).then(() => qc.invalidateQueries({ queryKey: ['seller-applications'] }))}><Check/>Approve</Button><Button variant="ghost" size="sm" onClick={() => void decide({ data: { id: a.id, approve: false } }).then(() => qc.invalidateQueries({ queryKey: ['seller-applications'] }))}><X/>Reject</Button></div>}</div>)}</div>;
}
