import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { ShareRow } from './referral';
import { tx } from '@/lib/dom-translate';
import { useServerFn } from '@tanstack/react-start';
import { getGroupPreview } from '@/lib/group.functions';
import { GROUP_DEFAULT_HOURS, GROUP_HOUR_PRESETS, GROUP_MAX_HOURS, GROUP_MAX_SIZE, GROUP_MIN_HOURS, GROUP_MIN_SIZE, clampGroupHours, clampGroupSize, groupDiscountPct, clearGroup, groupLink, isInvite, normalizeInvite, rememberGroup, storedGroup, timeLeft } from '@/lib/group';

export const groupRpc = (name: string, args?: object) => (supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);

type GroupStatus = 'active' | 'successful' | 'expired';
type MemberStatus = 'joined' | 'paid' | 'escrow_approved' | 'canceled';
export type PublicGroup = { id: string; invite_code?: string; product_id: string; title: string | null; price: number | null; image: string | null; leader: string; target_size: number; current_size: number; status: GroupStatus; expires_at: string; discount_pct: number; max_pct: number };
export type MyGroup = { id: string; invite_code?: string; product_id: string; title: string | null; target_size: number; current_size: number; status: GroupStatus; expires_at: string; created_at: string; duration_hours: number; discount_pct: number; is_leader: boolean; my_status: MemberStatus | null; refund_due_usd: number };
type Member = { nickname: string; status: MemberStatus; joined_at: string; is_leader: boolean; refund_due_usd: number };

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

export const usePublicGroup = (id: string | null | undefined) => useQuery({
  queryKey: ['group-public', id], enabled: !!id, refetchInterval: 15_000,
  queryFn: async () => { const { data, error } = await groupRpc('group_public', { _id: id }); if (error) throw error; return (data ?? null) as PublicGroup | null; },
});

/** 공동구매 링크 화면용: 상품 사진·설명·가격(로그인 없이) */
export const useGroupPreview = (groupId: string | null | undefined) => {
  const fn = useServerFn(getGroupPreview);
  return useQuery({ queryKey: ['group-preview', groupId], enabled: !!groupId, staleTime: 30 * 60_000, retry: 1, queryFn: () => fn({ data: { groupId: groupId as string } }) });
};

/** 체크아웃: 이 상품을 지금 사면 적용되는 공동구매 할인율 (없으면 null) */
export const useGroupQuote = (productId: string | undefined) => useQuery({
  queryKey: ['group-quote', productId], enabled: !!productId, staleTime: 10_000,
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await groupRpc('group_checkout_quote', { _product: productId, _group: storedGroup() });
    if (error) return null;
    const q = data as { group_id: string; pct: number; current_size: number; target_size: number; expires_at: string } | null;
    return q && q.pct > 0 ? q : null;
  },
});

const useMyGroups = () => useQuery({
  queryKey: ['group-mine'], staleTime: 5_000, refetchInterval: 15_000,
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await groupRpc('group_my_summary');
    if (error) throw error;
    return ((data as { groups?: MyGroup[] } | null)?.groups ?? []) as MyGroup[];
  },
});

/** 남은 시간 */
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const left = timeLeft(expiresAt, now);
  if (left.total <= 0) return <span>{tx('마감됐어요')}</span>;
  const text = left.days > 0 ? tx('{d}일 {h}시간 남음', { d: left.days, h: left.hours }) : left.hours > 0 ? tx('{h}시간 {m}분 남음', { h: left.hours, m: left.minutes }) : tx('{m}분 남음', { m: Math.max(1, left.minutes) });
  return <span data-no-translate>{text}</span>;
}

/** 공동구매 만들기: 생성자가 인원(2~10명)과 제한 시간(1~72시간, 기본 72시간)을 정한다. */
export function GroupCreate({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [size, setSize] = useState(4), [hours, setHours] = useState(GROUP_DEFAULT_HOURS), [hoursText, setHoursText] = useState(String(GROUP_DEFAULT_HOURS));
  const [created, setCreated] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error(tx('로그인이 필요합니다.'));
      const { data, error } = await groupRpc('create_group', { _product: productId, _size: clampGroupSize(size), _hours: clampGroupHours(hours) });
      if (error) throw error;
      return String(data);
    },
    onSuccess: id => { rememberGroup(id); setCreated(id); void qc.invalidateQueries({ queryKey: ['group-mine'] }); void qc.invalidateQueries({ queryKey: ['group-quote'] }); },
    onError: e => toast.error((e as Error).message || tx('공동구매를 만들지 못했어요. 다시 시도해 주세요.')),
  });
  const setH = (v: number) => { const n = clampGroupHours(v); setHours(n); setHoursText(String(n)); };
  const createdInfo = usePublicGroup(created);
  const code = createdInfo.data?.invite_code;
  if (created) {
    const link = groupLink(created);
    return <section className="mt-4 rounded-lg border border-border bg-card p-4" aria-label={tx('공동구매 링크')}>
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-primary" />{tx('공동구매가 만들어졌어요')}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{tx('이 링크를 친구에게 보내세요. 먼저 내가 이 상품을 구매해야 공동구매가 시작돼요.')}</p>
      <input readOnly value={link} onFocus={e => e.currentTarget.select()} className="mt-3 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-xs" aria-label={tx('공동구매 링크')} data-no-translate />
      {code && <p className="mt-2 text-xs text-muted-foreground">{tx('초대 코드')}: <strong className="select-all text-sm text-primary" data-no-translate>{code}</strong> · {tx('링크가 안 열리면 가입할 때 이 코드를 입력하면 돼요.')}</p>}
      <ShareRow link={link} message={code ? tx('VELA 공동구매 같이 해요! {link} (초대 코드: {code})', { link, code }) : tx('VELA 공동구매 같이 해요! {link}', { link })} shareText={tx('VELA 공동구매 같이 해요!')} />
    </section>;
  }
  return <section className="mt-4 rounded-lg border border-border bg-card p-4" aria-label={tx('공동구매 만들기')}>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-primary" />{tx('공동구매 만들기')}</h2>
    <p className="mt-2 text-xs text-muted-foreground">{tx('친구와 함께 사면 인원에 따라 가격이 바로 할인돼요. 공동구매 주문에는 포인트가 적립되지 않아요.')}</p>
    <label className="mt-3 block text-xs font-medium">{tx('인원 (2~10명)')}
      <select className="form-input mt-1 w-full" value={size} onChange={e => setSize(Number(e.target.value))} data-no-translate>
        {Array.from({ length: GROUP_MAX_SIZE - GROUP_MIN_SIZE + 1 }, (_, i) => i + GROUP_MIN_SIZE).map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
    <p className="mt-2 text-xs text-muted-foreground">{tx('{n}명이 모이면 최대 {p}% 즉시 할인', { n: size, p: groupDiscountPct(size) })}</p>
    <div className="mt-3 text-xs font-medium">{tx('제한 시간 (1~72시간)')}</div>
    <div className="mt-1 flex flex-wrap gap-2">
      {GROUP_HOUR_PRESETS.map(h => <Button key={h} type="button" size="sm" variant={hours === h ? 'gold' : 'goldOutline'} onClick={() => setH(h)} data-no-translate>{h}h</Button>)}
      <input className="form-input w-24" inputMode="numeric" aria-label={tx('제한 시간 직접 입력 (시간)')} value={hoursText} data-no-translate
        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); setHoursText(v); if (v) setHours(Math.min(GROUP_MAX_HOURS, Math.max(GROUP_MIN_HOURS, Number(v)))); }}
        onBlur={() => setH(Number(hoursText || GROUP_DEFAULT_HOURS))} />
    </div>
    <Button type="button" variant="gold" className="mt-4 w-full" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? tx('만드는 중…') : tx('공동구매 링크 만들기')}</Button>
  </section>;
}

/** 구매 페이지 상단: 공동구매 링크로 들어온 경우 현재 인원, 적용 중인 할인율과 남은 시간 */
export function GroupBanner({ productId }: { productId: string }) {
  const [gid] = useState(() => storedGroup());
  const g = usePublicGroup(gid).data;
  if (!gid || !g || g.product_id !== productId) return null;
  const open = g.status === 'active' && new Date(g.expires_at).getTime() > Date.now();
  return <section className="mt-4 rounded-lg border border-primary/40 bg-card p-4" aria-label={tx('공동구매 참여')}>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-primary" />{tx('공동구매에 참여 중이에요')}</h2>
    {open ? <>
      <p className="mt-2 text-sm"><strong data-no-translate>{g.current_size}/{g.target_size}</strong> · <strong className="text-primary" data-no-translate>{g.discount_pct}%</strong> {tx('즉시 할인')} · <Countdown expiresAt={g.expires_at} /></p>
      <p className="mt-1 text-xs text-muted-foreground">{tx('인원이 늘면 할인율이 올라가요. 최종 인원 기준 할인율로 정산돼요.')}</p>
    </> : <p className="mt-2 text-xs text-muted-foreground">{tx('이 공동구매는 마감됐어요. 일반 구매로 진행돼요.')}</p>}
  </section>;
}

const groupStatusLabel = (g: MyGroup) => g.status === 'active' ? tx('진행 중') : g.status === 'successful' ? tx('성사') : tx('마감');
const memberStatusLabel = (s: MemberStatus) => s === 'joined' ? tx('결제 대기') : s === 'paid' ? tx('결제 완료 (에스크로 진행 중)') : s === 'escrow_approved' ? tx('에스크로 승인 (완료)') : tx('취소');

/** 리더용: 참여자별 결제/에스크로 상태 (15초마다 갱신) */
function LeaderMembers({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ['group-leader', id], refetchInterval: 10_000,
    queryFn: async () => { const { data, error } = await groupRpc('group_leader_detail', { _id: id }); if (error) throw error; return ((data as { members?: Member[] } | null)?.members ?? []) as Member[]; },
  });
  if (!q.data) return <p className="mt-2 text-xs text-muted-foreground">{tx('불러오는 중…')}</p>;
  return <ul className="mt-2 grid gap-1 text-xs" aria-label={tx('참여자 현황')}>{q.data.map((m, i) => <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
    <span className="min-w-0 truncate"><span data-no-translate>{m.nickname || '—'}</span>{m.is_leader && <span className="ml-1 text-primary">· {tx('리더')}</span>}</span>
    <span className={m.status === 'canceled' ? 'text-destructive' : m.status === 'escrow_approved' ? 'text-primary' : 'text-muted-foreground'}>{memberStatusLabel(m.status)}</span>
  </li>)}</ul>;
}

function GroupRow({ g }: { g: MyGroup }) {
  const [open, setOpen] = useState(false);
  const refund = Number(g.refund_due_usd);
  return <div className="rounded-lg border border-border bg-card p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><strong className="block truncate text-sm" data-no-translate>{g.title ?? ''}</strong>
        <p className="mt-1 text-xs text-muted-foreground"><span data-no-translate>{g.current_size}/{g.target_size}</span> · <strong className="text-primary" data-no-translate>{g.discount_pct}%</strong> {tx('할인')} · {g.is_leader ? tx('리더') : tx('참여자')} · {groupStatusLabel(g)}</p>
        {g.status === 'active' && <p className="mt-1 text-xs"><Countdown expiresAt={g.expires_at} /></p>}
        {g.status === 'active' && g.is_leader && g.invite_code && <p className="mt-1 text-xs text-muted-foreground">{tx('초대 코드')}: <strong className="select-all text-primary" data-no-translate>{g.invite_code}</strong></p>}
        {g.my_status && <p className="mt-1 text-xs text-muted-foreground">{tx('내 상태')}: {memberStatusLabel(g.my_status)}</p>}
        {refund > 0 && <p className="mt-1 text-xs text-primary" data-no-translate>{tx('환급 예정')} {usd(refund)}</p>}
        {refund < 0 && <p className="mt-1 text-xs text-destructive" data-no-translate>{tx('추가 결제 필요')} {usd(-refund)}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {g.status === 'active' && g.is_leader && <Button type="button" variant="ghost" size="sm" onClick={() => { void navigator.clipboard?.writeText(groupLink(g.id)).then(() => toast.success(tx('링크를 복사했어요.')), () => toast.error(tx('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.'))); }}>{tx('링크 복사')}</Button>}
        {g.is_leader && <Button type="button" variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(v => !v)}>{tx('참여자')} <ChevronDown size={14} className={open ? 'rotate-180' : ''} /></Button>}
      </div>
    </div>
    {open && g.is_leader && <LeaderMembers id={g.id} />}
  </div>;
}

/** 마이페이지 위젯: 내가 만든/참여한 공동구매 (인원, 적용 할인율, 남은 시간, 참여자 상태) */
export function MyGroups({ compact = false }: { compact?: boolean }) {
  const q = useMyGroups();
  if (!q.data) return null;
  const list = compact ? q.data.filter(g => g.status !== 'expired').slice(0, 3) : q.data;
  if (!list.length) return <section className="mt-6" aria-label={tx('초대 코드 입력')}><div className="section-heading"><h2>{compact ? tx('초대 코드 입력') : tx('내 공동구매')}</h2></div>{compact ? null : <p className="mt-2 text-sm text-muted-foreground">{tx('아직 참여한 공동구매가 없어요. 상품 구매 화면에서 공동구매를 만들어 보세요.')}</p>}<InviteCodeEntry /></section>;
  return <section className="mt-6" aria-label={tx('내 공동구매')}>
    <div className="section-heading"><h2>{compact ? tx('내 진행 중인 공동구매') : tx('내 공동구매')}</h2></div>
    <div className="mt-3 grid gap-3">{list.map(g => <GroupRow key={g.id} g={g} />)}</div>
    <InviteCodeEntry />
  </section>;
}

/** 상품 상세 하단 바: "장바구니"와 "바로 구매" 사이의 공동구매 버튼. 누르면 공동구매 만들기 창이 열린다. */
export function GroupCreateButton({ productId, signedIn, requestAuth }: { productId: string; signedIn: boolean; requestAuth: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return <>
    <Button variant="goldOutline" onClick={() => (signedIn ? setOpen(true) : requestAuth())}>{tx('공동구매')}</Button>
    {open && typeof document !== 'undefined' && createPortal(<>
      <div className="lux-backdrop overlay-front" onClick={() => setOpen(false)} aria-hidden />
      <div className="lux-dialog" role="dialog" aria-modal="true" aria-label={tx('공동구매 만들기')} style={{ padding: 0 }}>
        <div className="flex justify-end px-3 pt-3"><Button type="button" variant="ghost" size="icon" aria-label={tx('닫기')} onClick={() => setOpen(false)}><X size={18} /></Button></div>
        <div className="px-4 pb-4 [&>section:first-child]:mt-0"><GroupBanner productId={productId} /><GroupCreate productId={productId} /></div>
      </div>
    </>, document.body)}
  </>;
}

const claimMessage = (r: string) => r === 'ok' ? tx('공동구매에 참여했어요.') : r === 'already' ? tx('이미 참여 중이에요.') : r === 'leader' ? tx('내가 만든 공동구매예요.')
  : r === 'closed' || r === 'full' ? tx('마감됐거나 인원이 가득 찬 공동구매예요.') : r === 'other_group' ? tx('이 상품의 다른 공동구매에 이미 참여 중이에요.') : tx('초대 코드를 찾을 수 없어요.');

/** 마이페이지: 초대 코드를 직접 입력해 공동구매에 참여 (링크가 안 열렸을 때의 대비책) */
export function InviteCodeEntry() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const apply = useMutation({
    mutationFn: async () => {
      const v = normalizeInvite(code);
      if (!isInvite(v)) return 'unknown';
      const { data, error } = await groupRpc('claim_group', { _id: v });
      if (error) throw error;
      return String(data);
    },
    onSuccess: r => { toast[r === 'ok' || r === 'already' ? 'success' : 'error'](claimMessage(r)); if (r === 'ok') { setCode(''); clearGroup(); } void qc.invalidateQueries({ queryKey: ['group-mine'] }); void qc.invalidateQueries({ queryKey: ['group-quote'] }); },
    onError: e => toast.error((e as Error).message),
  });
  return <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); if (code.trim()) apply.mutate(); }}>
    <input className="form-input min-w-0 flex-1" value={code} maxLength={40} placeholder="VELA-XXXX" aria-label={tx('초대 코드 입력')} data-no-translate onChange={e => setCode(e.target.value)} />
    <Button type="submit" size="sm" variant="goldOutline" disabled={apply.isPending || !code.trim()}>{tx('적용')}</Button>
  </form>;
}

/** 회원가입 화면: 초대 혜택 안내 + 초대 코드 칸(링크로 들어왔으면 자동 입력) */
export function SignupInvite({ code, setCode }: { code: string; setCode: (v: string) => void }) {
  const [touched, setTouched] = useState(false);
  const lookup = isInvite(code) ? normalizeInvite(code) : touched ? null : storedGroup();
  const g = usePublicGroup(lookup).data ?? null;
  useEffect(() => { if (g?.invite_code && !touched && !code) setCode(g.invite_code); }, [g?.invite_code, touched, code, setCode]);
  useEffect(() => { if (g && g.status === 'active') rememberGroup(g.id); }, [g?.id, g?.status]);
  const open = Boolean(g && g.status === 'active' && new Date(g.expires_at).getTime() > Date.now());
  return <div className="mt-4">
    {open && g && <div className="mb-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-xs leading-5"><p className="font-semibold text-primary">{tx('🎁 이 초대로 가입하면 최대 {p}% 즉시 할인을 받을 수 있어요. 가입과 동시에 공동구매에 자동 참여돼요.', { p: g.max_pct })}</p><p className="mt-1 text-muted-foreground" data-no-translate>{g.title}</p></div>}
    <label className="form-label" htmlFor="invite-code">{tx('초대 코드 (선택)')}</label>
    <input id="invite-code" className="form-input" value={code} maxLength={40} placeholder="VELA-XXXX" autoCapitalize="characters" autoComplete="off" data-no-translate onChange={e => { setTouched(true); setCode(e.target.value); }} />
  </div>;
}
