import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { Check, MessageCircle, ShieldCheck, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { decideSellerApplication, getMyAccount, listSellerApplications, submitSellerApplication, verifyWechatSample } from '@/lib/seller-accounts.functions';

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

export function SellerOnboarding({ user, requestAuth }: { user: User | null; requestAuth: () => void }) {
  const qc = useQueryClient(); const { data, isLoading } = useMyAccount(user);
  const verify = useServerFn(verifyWechatSample), submit = useServerFn(submitSellerApplication);
  const [step, setStep] = useState<'idle' | 'wechat'>('idle'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<unknown>) => { setBusy(true); setErr(''); try { await f(); await qc.invalidateQueries({ queryKey: ['my-account'] }); setStep('idle'); } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); } };
  if (!user) return <div className="mt-5 text-center"><p className="text-sm text-muted-foreground">Sign in to start your seller application.</p><Button variant="gold" className="mt-4" onClick={requestAuth}>Sign in</Button></div>;
  if (isLoading || !data) return <p className="mt-5 text-sm text-muted-foreground">Loading…</p>;
  const wx = data.wechat, app = data.application;
  return <div className="mt-5 space-y-5">
    <div className="seller-flow-card"><span className="lux-eyebrow">STEP 1 · IDENTITY</span>
      {wx ? <div className="mt-3 flex items-center gap-3"><ShieldCheck className="text-primary"/><div><strong>WeChat verified</strong><small className="block text-muted-foreground" data-no-translate>{wx.nickname} · {wx.wechat_id} · {wx.phone}</small>{wx.is_sample && <small className="block text-xs text-primary">Sample verification · real WeChat sign-in pending setup</small>}</div></div>
      : step === 'wechat' ? <form className="mt-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => verify({ data: { nickname: String(f.get('nickname')), phone: String(f.get('phone')) } })); }}>
          <p className="sample-notice">Sample WeChat step · real WeChat sign-in will replace this</p>
          <label className="form-label" htmlFor="wx-nick">WeChat nickname</label><input id="wx-nick" name="nickname" className="form-input" required maxLength={40}/>
          <label className="form-label" htmlFor="wx-phone">Phone number</label><input id="wx-phone" name="phone" className="form-input" required placeholder="+86 138 0000 0000"/>
          <Button variant="gold" className="mt-4 w-full" disabled={busy}>Confirm identity</Button></form>
      : <Button className="mt-3 w-full wechat-btn" onClick={() => setStep('wechat')}><MessageCircle/>Sign in with WeChat</Button>}
    </div>
    <div className={`seller-flow-card ${wx ? '' : 'opacity-50'}`}><span className="lux-eyebrow">STEP 2 · SELLER APPLICATION</span>
      {!wx ? <p className="mt-3 text-sm text-muted-foreground">Complete WeChat verification to continue.</p>
      : app && app.status !== 'rejected' ? <div className="mt-3"><strong>{app.status === 'approved' ? 'Approved — welcome to Vela' : 'Pending admin review'}</strong><p className="text-sm text-muted-foreground" data-no-translate>{app.studio_name}</p></div>
      : <form className="mt-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => submit({ data: { studio_name: String(f.get('studio')), region: String(f.get('region')), bio: String(f.get('bio')) } })); }}>
          {app?.status === 'rejected' && <p className="text-sm text-destructive">Previous application was declined. You may reapply.</p>}
          <label className="form-label" htmlFor="studio-name">Studio name</label><input id="studio-name" name="studio" className="form-input" required/>
          <label className="form-label" htmlFor="studio-region">Business region</label><input id="studio-region" name="region" className="form-input" required/>
          <label className="form-label" htmlFor="studio-bio">About your studio</label><textarea id="studio-bio" name="bio" className="form-input"/>
          <Button variant="gold" className="mt-4 w-full" disabled={busy}>Submit application</Button></form>}
    </div>
    {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
  </div>;
}

export function AdminApplications() {
  const qc = useQueryClient(); const list = useServerFn(listSellerApplications), decide = useServerFn(decideSellerApplication);
  const { data, error } = useQuery({ queryKey: ['seller-applications'], queryFn: () => list(), retry: false });
  if (error) return <p className="text-sm text-muted-foreground">Sign in with the Super Admin account to see real applications.</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No real applications yet.</p>;
  return <div className="management-list">{data.map(a => <div className="management-row" key={a.id}><div className="studio-initial">{a.studio_name[0]}</div><div><strong data-no-translate>{a.studio_name}</strong><small data-no-translate>{a.region} · WeChat {a.wechat_nickname} ({a.wechat_id}) · {a.wechat_phone}</small></div><span className="record-status">{a.status}</span>
    {a.status === 'pending' && <div className="record-actions"><Button variant="goldOutline" size="sm" onClick={() => void decide({ data: { id: a.id, approve: true } }).then(() => qc.invalidateQueries({ queryKey: ['seller-applications'] }))}><Check/>Approve</Button><Button variant="ghost" size="sm" onClick={() => void decide({ data: { id: a.id, approve: false } }).then(() => qc.invalidateQueries({ queryKey: ['seller-applications'] }))}><X/>Reject</Button></div>}</div>)}</div>;
}
