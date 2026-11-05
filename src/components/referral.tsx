import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Gift, MessageCircle, Send, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { clearReferral, referralLink, storedReferral, whatsappShareUrl, telegramShareUrl } from '@/lib/referral';
import { formatPoints } from '@/lib/loyalty';
import { tx } from '@/lib/dom-translate';
import { clearGroup, storedGroup } from '@/lib/group';

const rpc = (name: string, args?: object) => (supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);

type ReferralSummary = { user_id: string; referral_code?: string | null; min_order_usd?: number; expiry_days?: number; rate_pct: number; referred_users: number; completed_sales: number; earned_points: number; pending_points: number; pending_orders: number };

function useReferralSummary() {
  return useQuery({
    queryKey: ['referral-summary'], staleTime: 30_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await rpc('referral_my_summary');
      if (error) throw error;
      return data as unknown as ReferralSummary;
    },
  });
}


export type WelcomeCoupon = { id: string; pct: number; status: 'active' | 'used' | 'expired'; expires_at: string };
/** 내 가입 환영 쿠폰 (없으면 null). 주문 화면과 마이페이지에서 함께 쓴다. */
export function useWelcomeCoupon() {
  return useQuery({
    queryKey: ['welcome-coupon'], staleTime: 30_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await rpc('my_welcome_coupon');
      if (error) return null;
      return (data ?? null) as WelcomeCoupon | null;
    },
  });
}

/** 가입 화면: 추천 링크로 들어온 경우 코드가 적용됐고 환영 쿠폰이 나온다는 안내. */
export function ReferralSignupNote() {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => { setCode(storedReferral()); }, []);
  if (!code) return null;
  const short = code.length === 8;
  return <div className="mb-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-xs leading-5">
    <p className="font-semibold text-primary">{tx('🎁 추천 링크로 가입하면 5% 환영 쿠폰을 드려요. (공동구매 주문에는 함께 쓸 수 없어요)')}</p>
    {short && <p className="mt-1 text-muted-foreground">{tx('추천 코드')}: <span data-no-translate className="font-mono">{code}</span></p>}
  </div>;
}

/** 마이페이지: 내 환영 쿠폰 상태 */
function WelcomeCouponCard() {
  const { data: c } = useWelcomeCoupon();
  if (!c) return null;
  const date = new Date(c.expires_at).toLocaleDateString();
  const state = c.status === 'active' ? tx('사용 가능 · {d}까지', { d: date }) : c.status === 'used' ? tx('사용 완료') : tx('기간 만료');
  return <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3" aria-label={tx('가입 환영 쿠폰')}>
    <Ticket size={20} className="shrink-0 text-primary" aria-hidden />
    <div className="min-w-0 text-xs"><p className="text-sm font-semibold">{tx('가입 환영 쿠폰 {p}%', { p: c.pct })}</p><p className="text-muted-foreground">{state}</p><p className="text-muted-foreground">{tx('공동구매 주문에는 함께 쓸 수 없어요.')}</p></div>
  </div>;
}

/** 방문한 추천 링크를 로그인 후 내 계정에 연결한다. 앱 전체에서 한 번만 실행. */
export function ReferralTracker() {
  const qc = useQueryClient();
  useEffect(() => {
    let busy = false;
    const claim = async () => {
      if (busy) return;
      busy = true;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const authUser = sess.session?.user;
        if (!authUser) return;
        /* 가입 서버가 계정에 남겨 둔 초대 정보: 브라우저에 저장된 값이 없을 때 대신 사용한다(다른 브라우저로 이어서 로그인한 경우 등). */
        const meta = (authUser.user_metadata ?? {}) as { invite_group?: string; invite_ref?: string };
        const ref = storedReferral() ?? meta.invite_ref ?? null, grp = storedGroup() ?? meta.invite_group ?? null;
        if (!ref && !grp) return;
        let finished = true;
        if (ref) { const { data, error } = await rpc('claim_referral', { _code: ref }); if (!error && data) { clearReferral(); void qc.invalidateQueries({ queryKey: ['welcome-coupon'] }); void qc.invalidateQueries({ queryKey: ['referral-summary'] }); } else finished = false; } // 결과가 나오면(성공/거부 모두) 다시 시도하지 않음
        if (grp) {
          const { data, error } = await rpc('claim_group', { _id: grp });
          if (!error && data) { if (data !== 'ok' && data !== 'already' && data !== 'leader') clearGroup(); void qc.invalidateQueries({ queryKey: ['group-mine'] }); void qc.invalidateQueries({ queryKey: ['group-quote'] }); } else finished = false;
        }
        if (finished && (meta.invite_group || meta.invite_ref)) void supabase.auth.updateUser({ data: { invite_group: null, invite_ref: null } });
      } finally { busy = false; }
    };
    void claim();
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === 'SIGNED_IN') setTimeout(() => void claim(), 0); });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return null;
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try { const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); const ok = document.execCommand('copy'); el.remove(); return ok; } catch { return false; }
  }
}

/** 링크 복사 / WhatsApp / Telegram 버튼 줄 */
export function ShareRow({ link, message, shareText }: { link: string; message: string; shareText: string }) {
  const copy = async () => { if (await copyText(link)) toast.success(tx('링크를 복사했어요.')); else toast.error(tx('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.')); };
  return <div className="mt-3 grid grid-cols-3 gap-2">
    <Button variant="goldOutline" size="sm" onClick={() => void copy()}><Copy size={14} />링크 복사</Button>
    <Button variant="goldOutline" size="sm" asChild><a href={whatsappShareUrl(message)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} />WhatsApp</a></Button>
    <Button variant="goldOutline" size="sm" asChild><a href={telegramShareUrl(link, shareText)} target="_blank" rel="noopener noreferrer"><Send size={14} />Telegram</a></Button>
  </div>;
}

/** 공유하고 포인트 받기 — 추천 코드 만들기 → 링크 복사 / WhatsApp / Telegram */
export function ReferralShare({ compact = false }: { compact?: boolean }) {
  const summary = useReferralSummary();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const s = summary.data;
  if (!s?.user_id) return null;
  const rate = s.rate_pct ?? 5, min = s.min_order_usd ?? 500, days = s.expiry_days ?? 365;
  const make = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await rpc('generate_referral_code');
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['referral-summary'] });
    } catch { toast.error(tx('추천 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.')); } finally { setBusy(false); }
  };
  const link = s.referral_code ? referralLink(s.referral_code) : '';
  const message = tx('VELA에서 함께 쇼핑해요! {link}', { link });
  return <section className="mt-4 rounded-lg border border-border bg-card p-4" aria-label={tx('공유하고 포인트 받기')}>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Gift size={16} className="text-primary" />{tx('공유하고 포인트 받기')}</h2>
    {!compact && <p className="mt-2 text-xs text-muted-foreground">{tx('친구가 내 링크로 가입해 구매를 완료하면 결제 상품금액의 {rate}%를 포인트로 드려요. (배송비·세금 제외, 수령 확정 후 지급)', { rate })}</p>}
    {!compact && <p className="mt-1 text-xs text-muted-foreground">{tx('추천 포인트는 ${min} 이상 주문에만 쓸 수 있고, 적립 후 {days}일이 지나면 사라져요.', { min, days })}</p>}
    {link ? <>
      <div className="mt-3 flex items-center gap-2"><input readOnly value={link} onFocus={e => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs" aria-label={tx('내 추천 링크')} data-no-translate />
        <Button type="button" variant="gold" size="icon" aria-label={tx('링크 복사')} title={tx('링크 복사')} onClick={() => void copyText(link).then(ok => { if (ok) toast.success(tx('링크를 복사했어요.')); else toast.error(tx('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.')); })}><Copy size={16} /></Button></div>
      <p className="mt-2 text-xs text-muted-foreground">{tx('내 추천 코드')}: <span data-no-translate className="font-mono font-semibold text-foreground">{s.referral_code}</span></p>
      <ShareRow link={link} message={message} shareText={tx('VELA에서 함께 쇼핑해요!')} />
    </> : <Button type="button" variant="gold" className="mt-3 w-full" disabled={busy} onClick={() => void make()}>{tx('레퍼럴 코드 생성')}</Button>}
    {!compact && <WelcomeCouponCard />}
  </section>;
}

/** 내 추천 현황 */
export function ReferralDashboard() {
  const { data: s } = useReferralSummary();
  if (!s) return null;
  const stats: [string, string][] = [['추천한 친구', String(s.referred_users)], ['구매 완료 건수', String(s.completed_sales)], ['누적 추천 포인트', formatPoints(s.earned_points)], ['정산 대기 포인트', formatPoints(s.pending_points)]];
  return <section className="mt-6" aria-label={tx('추천 현황')}>
    <div className="section-heading"><h2>추천 현황</h2></div>
    <div className="dashboard-stats mt-3">{stats.map(([l, v]) => <div className="stat-item" key={l}><span>{l}</span><strong data-no-translate>{v}</strong></div>)}</div>
    <p className="mt-2 text-xs text-muted-foreground">정산 대기 포인트는 친구가 수령 확정(에스크로 정산)을 하면 지급됩니다. 취소·환불·분쟁 주문은 지급되지 않고, 지급 후 환불되면 회수됩니다.</p>
  </section>;
}
