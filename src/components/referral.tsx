import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Gift, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { clearReferral, referralLink, storedReferral, whatsappShareUrl } from '@/lib/referral';
import { formatPoints } from '@/lib/loyalty';
import { tx } from '@/lib/dom-translate';
import { clearGroup, storedGroup } from '@/lib/group';

const rpc = (name: string, args?: object) => (supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);

type ReferralSummary = { user_id: string; rate_pct: number; referred_users: number; completed_sales: number; earned_points: number; pending_points: number; pending_orders: number };

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

/** 방문한 추천 링크를 로그인 후 내 계정에 연결한다. 앱 전체에서 한 번만 실행. */
export function ReferralTracker() {
  const qc = useQueryClient();
  useEffect(() => {
    let busy = false;
    const claim = async () => {
      if (busy) return;
      const ref = storedReferral(), grp = storedGroup();
      if (!ref && !grp) return;
      busy = true;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        if (ref) { const { data, error } = await rpc('claim_referral', { _code: ref }); if (!error && data) clearReferral(); } // 결과가 나오면(성공/거부 모두) 다시 시도하지 않음
        if (grp) {
          const { data, error } = await rpc('claim_group', { _id: grp });
          if (!error && data) { if (data !== 'ok' && data !== 'already' && data !== 'leader') clearGroup(); void qc.invalidateQueries({ queryKey: ['group-mine'] }); void qc.invalidateQueries({ queryKey: ['group-quote'] }); }
        }
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

/** 링크 복사 / WhatsApp / 카카오톡(공유 메뉴, 안 되면 복사) 버튼 줄 */
export function ShareRow({ link, message, shareText }: { link: string; message: string; shareText: string }) {
  const copy = async () => { if (await copyText(link)) toast.success(tx('링크를 복사했어요.')); else toast.error(tx('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.')); };
  const kakao = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'VELA', text: shareText, url: link }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    if (await copyText(message)) toast.success(tx('링크를 복사했어요. 카카오톡에 붙여넣어 보내 주세요.')); else toast.error(tx('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.'));
  };
  return <div className="mt-3 grid grid-cols-3 gap-2">
    <Button variant="goldOutline" size="sm" onClick={() => void copy()}><Copy size={14} />링크 복사</Button>
    <Button variant="goldOutline" size="sm" asChild><a href={whatsappShareUrl(message)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} />WhatsApp</a></Button>
    <Button variant="goldOutline" size="sm" onClick={() => void kakao()}><Share2 size={14} />카카오톡</Button>
  </div>;
}

/** 공유하고 포인트 받기 — 링크 복사 / WhatsApp / 카카오톡 */
export function ReferralShare({ compact = false }: { compact?: boolean }) {
  const summary = useReferralSummary();
  const uid = summary.data?.user_id;
  if (!uid) return null;
  const link = referralLink(uid);
  const rate = summary.data?.rate_pct ?? 2;
  const message = tx('VELA에서 함께 쇼핑해요! {link}', { link });
  return <section className="mt-4 rounded-lg border border-border bg-card p-4" aria-label={tx('공유하고 포인트 받기')}>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Gift size={16} className="text-primary" />공유하고 포인트 받기</h2>
    {!compact && <p className="mt-2 text-xs text-muted-foreground">{tx('친구가 내 링크로 가입해 구매를 완료하면 결제 상품금액의 {rate}%를 포인트로 드려요. (배송비·세금 제외, 수령 확정 후 지급)', { rate })}</p>}
    <div className="mt-3 flex items-center gap-2"><input readOnly value={link} onFocus={e => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs" aria-label={tx('내 추천 링크')} data-no-translate /></div>
    <ShareRow link={link} message={message} shareText={tx('VELA에서 함께 쇼핑해요!')} />
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
