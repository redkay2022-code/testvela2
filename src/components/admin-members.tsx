import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import * as Dialog from '@radix-ui/react-dialog';
import { Ban, Clock, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { Button } from './ui/button';
import { BarsChart, Donut, countryName } from './mini-charts';
import { supabase } from '@/integrations/supabase/client';
import { adminLiftSanction, adminListMembers, adminSanctionMember, type MemberRow } from '@/lib/admin-members.functions';

const fmt = (v: string | null) => (v ? new Date(v).toLocaleDateString('ko-KR') : '—');
const fmtTime = (v: string | null) => (v ? new Date(v).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ACTIONS = [['7d', '7일 정지'], ['15d', '15일 정지'], ['30d', '30일 정지'], ['ban', '영구 추방']] as const;
type Action = (typeof ACTIONS)[number][0];

/** Back-office: member list, suspension (7 / 15 / 30 days) and permanent ban. Every change re-checks the admin's password. */
export function AdminMembers() {
  const qc = useQueryClient();
  const list = useServerFn(adminListMembers), sanction = useServerFn(adminSanctionMember), lift = useServerFn(adminLiftSanction);
  const [q, setQ] = useState(''), [applied, setApplied] = useState(''), [page, setPage] = useState(0);
  const [target, setTarget] = useState<{ row: MemberRow; mode: 'sanction' | 'lift' } | null>(null);
  const [action, setAction] = useState<Action>('7d'), [reason, setReason] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const data = useQuery({ queryKey: ['admin-members', applied, page], queryFn: () => list({ data: { q: applied, page } }), placeholderData: prev => prev });
  const rows = data.data?.rows ?? [], total = data.data?.total ?? 0, size = data.data?.pageSize ?? 20;

  const open = (row: MemberRow, mode: 'sanction' | 'lift') => { setTarget({ row, mode }); setAction('7d'); setReason(''); setPassword(''); setError(''); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || busy) return;
    setBusy(true); setError('');
    try {
      if (target.mode === 'lift') await lift({ data: { userId: target.row.user_id, password } });
      else await sanction({ data: { userId: target.row.user_id, action, reason, password } });
      setMsg(`${target.row.nickname} · ${target.mode === 'lift' ? '제재를 해제했습니다.' : `${ACTIONS.find(a => a[0] === action)?.[1]} 처리했습니다.`}`);
      setTarget(null);
      await qc.invalidateQueries({ queryKey: ['admin-members'] });
    } catch (err) { setError(err instanceof Error && err.message ? err.message : '처리하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const status = (r: MemberRow) => r.sanction ? <span className="catalog-pill warn">{r.sanction.kind === 'ban' ? '영구 추방' : `정지 ~ ${fmt(r.sanction.ends_at)}`}</span> : <span className="catalog-pill on">정상</span>;

  return <div className="catalog mt-4" lang="ko" data-no-translate>
    <TrafficSummary/>
    <div className="section-heading mt-6"><h2>회원 관리</h2><span>{total}명</span></div>
    <form className="catalog-toolbar" onSubmit={e => { e.preventDefault(); setPage(0); setApplied(q.trim()); }}>
      <input aria-label="회원 검색" placeholder="닉네임 또는 시스템 ID" value={q} onChange={e => setQ(e.target.value)} maxLength={60}/>
      <Button type="submit" variant="goldOutline">검색</Button>
    </form>
    {msg && <p role="status" className="dashboard-message">{msg}</p>}
    {data.isError ? <p role="alert" className="mt-3 text-sm">회원 목록을 불러오지 못했습니다.</p> : <div className="catalog-scroll"><table className="catalog-table"><thead><tr><th>회원</th><th>가입일</th><th>최근 접속</th><th>댓글</th><th>주문</th><th>상태</th><th>제재</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.user_id}>
        <td><strong>{r.nickname}</strong>{r.roles.includes('admin') && <span className="catalog-pill ml-1">관리자</span>}{r.roles.includes('seller') && <span className="catalog-pill ml-1">셀러</span>}<br/><small className="text-muted-foreground">{r.system_code}</small></td>
        <td>{fmt(r.created_at)}</td><td>{fmtTime(r.last_sign_in_at)}</td><td>{r.comments}</td><td>{r.orders}</td><td>{status(r)}</td>
        <td><div className="catalog-actions">{r.roles.includes('admin') ? <small className="text-muted-foreground">—</small> : r.sanction
          ? <Button size="sm" variant="goldOutline" onClick={() => open(r, 'lift')}><ShieldCheck/>해제</Button>
          : <Button size="sm" variant="ghost" onClick={() => open(r, 'sanction')}><Ban/>정지/추방</Button>}</div></td>
      </tr>)}
      {!rows.length && !data.isLoading && <tr><td colSpan={7} className="text-center text-muted-foreground">회원이 없습니다.</td></tr>}
    </tbody></table></div>}
    <div className="mt-3 flex items-center justify-between text-sm"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>이전</Button><span>{page + 1} / {Math.max(1, Math.ceil(total / size))}</span><Button size="sm" variant="ghost" disabled={(page + 1) * size >= total} onClick={() => setPage(p => p + 1)}>다음</Button></div>

    <Dialog.Root open={target !== null} onOpenChange={o => { if (!o) setTarget(null); }}><Dialog.Portal><Dialog.Overlay className="drawer-backdrop auth-backdrop"/>
      <Dialog.Content className="auth-dialog" aria-describedby={undefined} lang="ko" data-no-translate>
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center"><Dialog.Title className="flex items-center gap-2 text-lg font-bold"><ShieldAlert className="text-destructive" size={20}/>{target?.mode === 'lift' ? '제재 해제' : '회원 제재'}</Dialog.Title><Button type="button" variant="ghost" size="icon" aria-label="닫기" onClick={() => setTarget(null)}><X/></Button></div>
        <form onSubmit={submit}>
          <p className="text-sm"><strong>{target?.row.nickname}</strong> <span className="text-muted-foreground">({target?.row.system_code})</span></p>
          {target?.mode === 'sanction' && <>
            <label className="form-label mt-4" htmlFor="sanction-action">조치</label>
            <select id="sanction-action" className="form-input" value={action} onChange={e => setAction(e.target.value as Action)}>{ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground"><Clock size={13} className="mt-0.5 shrink-0"/>{action === 'ban' ? '로그인이 차단되고 되돌리려면 관리자가 직접 해제해야 합니다.' : '정지 기간에는 댓글·리뷰 작성과 구매가 차단됩니다. 로그인하면 정지 안내가 표시됩니다.'}</p>
            <label className="form-label mt-4" htmlFor="sanction-reason">사유 (회원에게 표시됨)</label>
            <textarea id="sanction-reason" className="form-input" rows={3} required minLength={2} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 반복적인 비방 댓글"/>
          </>}
          <label className="form-label mt-4" htmlFor="sanction-password">관리자 비밀번호</label>
          <input id="sanction-password" className="form-input" type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={e => setPassword(e.target.value)}/>
          {error && <p role="alert" className="mt-3 text-xs leading-5 text-destructive">{error}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2"><Button type="button" variant="ghost" onClick={() => setTarget(null)}>취소</Button><Button type="submit" variant="destructive" disabled={busy || !password || (target?.mode === 'sanction' && reason.trim().length < 2)}>{busy ? '처리 중…' : target?.mode === 'lift' ? '해제하기' : '적용하기'}</Button></div>
        </form>
      </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}

type Traffic = { live: number; today_visitors: number; members: number; sanctioned: number; avg_session_sec: number; days: number; daily: { d: string; visitors: number; signups: number }[]; countries: { country: string; n: number }[] };
const rpc = (name: string, args: object) => (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);

/** Platform-wide visitor and sign-up numbers. */
export function TrafficSummary() {
  const q = useQuery({ queryKey: ['admin-traffic'], refetchInterval: 30_000, queryFn: async () => { const { data, error } = await rpc('admin_traffic_stats', { _days: 30 }); if (error) throw new Error(error.message); return data as Traffic | null; } });
  const s = q.data;
  const dur = s ? `${Math.floor(s.avg_session_sec / 60)}분 ${s.avg_session_sec % 60}초` : '—';
  return <section aria-label="접속 현황">
    <div className="section-heading"><h2>접속 · 가입 현황</h2><span>최근 30일</span></div>
    {q.isError ? <p className="text-sm text-muted-foreground">통계를 불러오지 못했습니다. DB 업데이트(0035) 적용 여부를 확인해 주세요.</p> : !s ? <p className="text-sm text-muted-foreground">불러오는 중…</p> : <>
      <div className="dashboard-stats">{[['지금 접속자', s.live, '최근 5분'], ['오늘 방문자', s.today_visitors, '순 방문자'], ['전체 회원', s.members, `제재 중 ${s.sanctioned}명`], ['평균 이용 시간', dur, '세션 기준']].map(([label, value, note]) => <div className="stat-item" key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong><small>{String(note)}</small></div>)}</div>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div><h3 className="mb-2 text-sm font-semibold">일별 방문자</h3><BarsChart label="일별 방문자" data={s.daily.map(d => ({ label: d.d, value: d.visitors }))}/></div>
        <div><h3 className="mb-2 text-sm font-semibold">일별 신규 가입</h3><BarsChart label="일별 신규 가입" data={s.daily.map(d => ({ label: d.d, value: d.signups }))}/></div>
      </div>
      <h3 className="mb-2 mt-5 text-sm font-semibold">접속 국가</h3><Donut label="접속 국가 비율" items={s.countries.map(c => ({ label: countryName(c.country), value: c.n }))}/>
    </>}
  </section>;
}
