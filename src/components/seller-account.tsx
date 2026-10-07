import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { Check, ShieldCheck, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { decideSellerApplication, getMyAccount, listSellerApplications, submitSellerApplication, updateNickname } from '@/lib/seller-accounts.functions';
import { uploadAvatar, useAvatarUrl } from '@/lib/avatar';

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
  const avatarUrl = useAvatarUrl(data?.profile?.avatar_url);
  useEffect(() => { if (data?.profile) setValue(data.profile.nickname); }, [data?.profile]);
  if (!data?.profile || !user) return null;
  return <form className="seller-flow-card" onSubmit={async e => { e.preventDefault(); setMsg(''); try { await save({ data: { nickname: value } }); await qc.invalidateQueries({ queryKey: ['my-account'] }); setMsg('Saved'); } catch (err) { setMsg(err instanceof Error ? err.message : 'Could not save'); } }}>
    <span className="lux-eyebrow">ACCOUNT</span>
    <label className="mt-3 flex cursor-pointer items-center gap-3">
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-input bg-muted">{avatarUrl ? <img src={avatarUrl} alt="프로필 사진" className="size-full object-cover" /> : <User size={22} className="text-muted-foreground" />}</span>
      <span className="text-sm text-muted-foreground">프로필 사진 변경 (5MB 이하)</span>
      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="프로필 사진 변경" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setMsg(''); try { await uploadAvatar(user.id, f); await qc.invalidateQueries({ queryKey: ['my-account'] }); setMsg('Saved'); } catch (err) { setMsg(err instanceof Error ? err.message : 'Could not save'); } }} />
    </label>
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

const statusLabel: Record<string, string> = { pending: '검토 대기', approved: '승인됨', rejected: '거절됨' };

export function AdminApplications() {
  const qc = useQueryClient(); const list = useServerFn(listSellerApplications), decide = useServerFn(decideSellerApplication);
  const { data, error, isLoading } = useQuery({ queryKey: ['seller-applications'], queryFn: () => list(), retry: false, refetchInterval: 30000 });
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState('');
  if (isLoading) return <p className="text-sm text-muted-foreground">판매자 신청을 불러오는 중…</p>;
  if (error) return <p className="text-sm text-muted-foreground">실제 신청은 관리자 계정으로 로그인한 후 확인할 수 있습니다.</p>;
  const rows = data ?? [];
  const count = (s: string) => rows.filter(a => a.status === s).length;
  const shown = filter === 'all' ? rows : rows.filter(a => a.status === filter);
  const act = async (id: string, approve: boolean, name: string) => {
    if (!approve && !confirm(`${name} 님의 판매자 권한을 거절/해제할까요?`)) return;
    setBusy(id); setMsg('');
    try { await decide({ data: { id, approve } }); await qc.invalidateQueries({ queryKey: ['seller-applications'] }); setMsg(`${name} · ${approve ? '승인 완료 — 판매자 권한이 부여되었습니다.' : '거절 처리 — 판매자 권한이 해제되었습니다.'}`); }
    catch (e) { setMsg(e instanceof Error ? e.message : '처리하지 못했습니다.'); } finally { setBusy(null); }
  };
  return <div>
    <div className="flex flex-wrap gap-2 py-3">{([['pending', '대기'], ['approved', '승인'], ['rejected', '거절'], ['all', '전체']] as const).map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? 'goldOutline' : 'ghost'} onClick={() => setFilter(k)}>{l} {k === 'all' ? rows.length : count(k)}</Button>)}</div>
    {msg && <p role="status" className="mb-2 text-sm text-primary">{msg}</p>}
    {!shown.length ? <p className="text-sm text-muted-foreground">{filter === 'pending' ? '검토 대기 중인 신청이 없습니다.' : '해당하는 신청이 없습니다.'}</p> :
    <div className="management-list">{shown.map(a => { const name = a.nickname ?? 'Member'; return <div className="management-row" key={a.id}><div className="studio-initial">{name[0]}</div><div><strong data-no-translate>{name}</strong><small data-no-translate>#{a.system_code ?? '—'} · {new Date(a.created_at).toLocaleDateString('ko-KR')}</small></div><span className="record-status">{statusLabel[a.status] ?? a.status}</span>
      <div className="record-actions">
        {a.status !== 'approved' && <Button variant="goldOutline" size="sm" disabled={busy === a.id} onClick={() => void act(a.id, true, name)}><Check/>승인</Button>}
        {a.status !== 'rejected' && <Button variant="ghost" size="sm" disabled={busy === a.id} onClick={() => void act(a.id, false, name)}><X/>{a.status === 'approved' ? '권한 해제' : '거절'}</Button>}
      </div></div>; })}</div>}
  </div>;
}
