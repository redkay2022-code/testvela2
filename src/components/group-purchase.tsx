import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { ShareRow } from './referral';
import { tx } from '@/lib/dom-translate';
import { formatPoints } from '@/lib/loyalty';
import { GROUP_DEFAULT_HOURS, GROUP_HOUR_PRESETS, GROUP_MAX_HOURS, GROUP_MAX_SIZE, GROUP_MIN_HOURS, GROUP_MIN_SIZE, clampGroupHours, clampGroupSize, groupLink, groupTier, rememberGroup, storedGroup, timeLeft } from '@/lib/group';

const rpc = (name: string, args?: object) => (supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);

export type PublicGroup = { id: string; product_id: string; title: string | null; price: number | null; image: string | null; leader: string; target_size: number; current_size: number; status: 'active' | 'successful' | 'expired'; expires_at: string; participant_pct: number; leader_pct: number; welcome: boolean };
export type MyGroup = { id: string; product_id: string; title: string | null; target_size: number; current_size: number; status: 'active' | 'successful' | 'expired'; expires_at: string; created_at: string; paid_at: string | null; duration_hours: number; is_leader: boolean; reward_points: number };

export const usePublicGroup = (id: string | null | undefined) => useQuery({
  queryKey: ['group-public', id], enabled: !!id, refetchInterval: 30_000,
  queryFn: async () => { const { data, error } = await rpc('group_public', { _id: id }); if (error) throw error; return (data ?? null) as PublicGroup | null; },
});

const useMyGroups = () => useQuery({
  queryKey: ['group-mine'], staleTime: 15_000,
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await rpc('group_my_summary');
    if (error) throw error;
    return ((data as { groups?: MyGroup[] } | null)?.groups ?? []) as MyGroup[];
  },
});

/** 1초마다 갱신되는 남은 시간 문구 */
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const left = timeLeft(expiresAt, now);
  if (left.total <= 0) return <span>{tx('마감됐어요')}</span>;
  const text = left.days > 0 ? tx('{d}일 {h}시간 남음', { d: left.days, h: left.hours }) : left.hours > 0 ? tx('{h}시간 {m}분 남음', { h: left.hours, m: left.minutes }) : tx('{m}분 남음', { m: Math.max(1, left.minutes) });
  return <span data-no-translate>{text}</span>;
}

function TierPreview({ size }: { size: number }) {
  const t = groupTier(size);
  return <p className="text-xs text-muted-foreground">{tx('{n}명이 모이면 참여자 {p}% · 리더 +{l}% 포인트', { n: size, p: t.participant, l: t.leader })}{t.welcome ? ` · ${tx('웰컴 보너스 포인트')}` : ''}</p>;
}

/** 공동구매 만들기: 생성자가 인원(2~10명)과 제한 시간(1~72시간)을 직접 정한다. */
export function GroupCreate({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [size, setSize] = useState(4), [hours, setHours] = useState(GROUP_DEFAULT_HOURS), [hoursText, setHoursText] = useState(String(GROUP_DEFAULT_HOURS));
  const [created, setCreated] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error(tx('로그인이 필요합니다.'));
      const { data, error } = await rpc('create_group', { _product: productId, _size: clampGroupSize(size), _hours: clampGroupHours(hours) });
      if (error) throw error;
      return String(data);
    },
    onSuccess: id => { rememberGroup(id); setCreated(id); void qc.invalidateQueries({ queryKey: ['group-mine'] }); },
    onError: e => toast.error((e as Error).message || tx('공동구매를 만들지 못했어요. 다시 시도해 주세요.')),
  });
  const setH = (v: number) => { const n = clampGroupHours(v); setHours(n); setHoursText(String(n)); };
  if (created) {
    const link = groupLink(created);
    return <section className="mt-4 rounded-lg border border-border bg-card p-4" aria-label={tx('공동구매 링크')}>
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-primary" />{tx('공동구매가 만들어졌어요')}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{tx('이 링크를 친구에게 보내세요. 먼저 내가 이 상품을 구매해야 공동구매가 시작돼요.')}</p>
      <input readOnly value={link} onFocus={e => e.currentTarget.select()} className="mt-3 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-xs" aria-label={tx('공동구매 링크')} data-no-translate />
      <ShareRow link={link} message={tx('VELA 공동구매 같이 해요! {link}', { link })} shareText={tx('VELA 공동구매 같이 해요!')} />
    </section>;
  }
  return <section className="mt-4 rounded-lg border border-border bg-card p-4" aria-label={tx('공동구매 만들기')}>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-primary" />{tx('공동구매 만들기')}</h2>
    <p className="mt-2 text-xs text-muted-foreground">{tx('친구와 함께 사면 모두 포인트를 더 받아요. 인원과 제한 시간을 정해 링크를 만드세요.')}</p>
    <label className="mt-3 block text-xs font-medium">{tx('인원 (2~10명)')}
      <select className="form-input mt-1 w-full" value={size} onChange={e => setSize(Number(e.target.value))} data-no-translate>
        {Array.from({ length: GROUP_MAX_SIZE - GROUP_MIN_SIZE + 1 }, (_, i) => i + GROUP_MIN_SIZE).map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
    <TierPreview size={size} />
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

/** 구매 페이지 상단: 공동구매 링크로 들어온 경우 현재 모인 인원과 남은 시간을 보여준다. */
export function GroupBanner({ productId }: { productId: string }) {
  const [gid] = useState(() => storedGroup());
  const g = usePublicGroup(gid).data;
  if (!gid || !g || g.product_id !== productId) return null;
  const open = g.status === 'active' && new Date(g.expires_at).getTime() > Date.now();
  return <section className="mt-4 rounded-lg border border-primary/40 bg-card p-4" aria-label={tx('공동구매 참여')}>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={16} className="text-primary" />{tx('공동구매에 참여 중이에요')}</h2>
    {open ? <>
      <p className="mt-2 text-sm"><strong data-no-translate>{g.current_size}/{g.target_size}</strong> · <Countdown expiresAt={g.expires_at} /></p>
      <p className="mt-1 text-xs text-muted-foreground">{tx('모두 수령 확정을 하면 참여자 {p}% 포인트가 지급돼요.', { p: g.participant_pct })}</p>
    </> : <p className="mt-2 text-xs text-muted-foreground">{tx('이 공동구매는 마감됐어요. 일반 구매로 진행돼요.')}</p>}
  </section>;
}

const statusLabel = (g: MyGroup) => g.status === 'active' ? tx('진행 중') : g.status === 'successful' ? (g.paid_at ? tx('완료') : tx('인원 모집 완료')) : tx('마감');

/** 내 공동구매: 진행 / 완료 상태와 받은 포인트 */
export function MyGroups({ compact = false }: { compact?: boolean }) {
  const q = useMyGroups();
  if (!q.data) return null;
  const list = compact ? q.data.filter(g => g.status !== 'expired').slice(0, 3) : q.data;
  if (!list.length) return compact ? null : <section className="mt-6"><div className="section-heading"><h2>{tx('내 공동구매')}</h2></div><p className="mt-2 text-sm text-muted-foreground">{tx('아직 참여한 공동구매가 없어요. 상품 구매 화면에서 공동구매를 만들어 보세요.')}</p></section>;
  return <section className="mt-6" aria-label={tx('내 공동구매')}>
    <div className="section-heading"><h2>{tx('내 공동구매')}</h2></div>
    <div className="management-list mt-3">{list.map(g => <div className="management-row" key={g.id}>
      <div className="min-w-0"><strong className="block truncate" data-no-translate>{g.title ?? ''}</strong>
        <small><span data-no-translate>{g.current_size}/{g.target_size}</span> · {g.is_leader ? tx('리더') : tx('참여자')} · {statusLabel(g)}{g.status === 'active' && <> · <Countdown expiresAt={g.expires_at} /></>}</small></div>
      <div className="text-right text-xs">{g.reward_points > 0 ? <strong className="text-primary" data-no-translate>+{formatPoints(g.reward_points)}</strong> : null}
        {g.status === 'active' && g.is_leader && <Button type="button" variant="ghost" size="sm" onClick={() => { void navigator.clipboard?.writeText(groupLink(g.id)).then(() => toast.success(tx('링크를 복사했어요.')), () => toast.error(tx('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.'))); }}>{tx('링크 복사')}</Button>}</div>
    </div>)}</div>
  </section>;
}
