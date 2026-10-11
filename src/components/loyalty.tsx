import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Coins, Gift, Hourglass, ShieldCheck, TrendingUp, Wallet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { clampRedeem, daysUntil, earnPoints, formatPoints, formatPointsUsd, maxRedeemPoints, pointsToUsd } from '@/lib/loyalty';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const icons: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };
const typeLabel: Record<string, string> = { EARN: '적립', REDEEM: '사용', REFUND: '사용 취소 복구', REVERSAL: '적립 회수', EXPIRED: '만료', ADMIN_ADJUSTMENT: '관리자 조정', BONUS: '보너스' };

type Summary = { available: number; pending: number; lifetime_earned: number; lifetime_redeemed: number; expiring_soon: number; expiring_at: string | null; tier: string; spend: number };

function useUid() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); const { data } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user?.id ?? null)); return () => data.subscription.unsubscribe(); }, []);
  return uid;
}
export function useLoyaltyRules() {
  return useQuery({ queryKey: ['loyalty-rules'], staleTime: 60_000, queryFn: async () => {
    const [s, c] = await Promise.all([supabase.from('loyalty_settings').select('*').order('sort_order'), supabase.from('loyalty_config').select('*').eq('id', 1).maybeSingle()]);
    if (s.error) throw s.error; if (c.error) throw c.error;
    return { tiers: s.data ?? [], config: c.data };
  } });
}
export function useLoyaltySummary() {
  const uid = useUid();
  const q = useQuery({ queryKey: ['loyalty-summary', uid], enabled: !!uid, staleTime: 15_000, queryFn: async () => {
    const { data, error } = await supabase.rpc('loyalty_my_summary'); if (error) throw error; return data as unknown as Summary;
  } });
  return { uid, ...q };
}

export function MembershipCard({ onWallet }: { onWallet?: () => void }) {
  const summary=useLoyaltySummary(), rulesQuery=useLoyaltyRules();
  const s=summary.data, rules=rulesQuery.data;
  if(!summary.uid) return null;
  if(summary.isError||rulesQuery.isError) return <p role="alert" className="py-5 text-sm text-destructive">멤버십 정보를 불러오지 못했습니다.</p>;
  if(!s||!rules) return <p className="py-5 text-sm text-muted-foreground">멤버십을 불러오는 중…</p>;
  const tiers=rules.tiers, value=Number(rules.config?.point_value_usd ?? 0.001);
  const idx=Math.max(0,tiers.findIndex(t=>t.tier===s.tier)),cur=tiers[idx],next=tiers[idx+1];
  if(!cur) return null;
  const remaining=next?Math.max(0,Number(next.spend_min)+1-Number(s.spend)):0;
  const progress=next?Math.min(100,Math.max(0,(Number(s.spend)-Number(cur.spend_min))/(Number(next.spend_min)+1-Number(cur.spend_min))*100)):100;
  return <section className="customer-membership" aria-label="VELA 멤버십과 지갑" lang="ko" data-no-translate>
    <div className="section-heading"><h2>멤버십 · VELA 지갑</h2><ShieldCheck className="text-primary"/></div>
    <div className="flex justify-between items-end gap-3"><strong className="text-2xl text-primary">{cur.tier.toUpperCase()}</strong><span className="text-xs text-muted-foreground">최근 12개월 구매 {usd(Number(s.spend))}</span></div>
    <progress className="customer-tier-progress" max={100} value={progress} aria-label="다음 등급까지 구매 진행률"/>
    <p className="text-xs text-muted-foreground">{next?<>{`${next.tier.toUpperCase()}까지`} <strong className="text-primary">{usd(remaining)}</strong></>:'최고 등급입니다.'}</p>
    <ul className="flex flex-wrap gap-x-5 gap-y-2 my-4 text-sm"><li>{`보험료 ${Math.round(Number(cur.insurance_discount)*100)}% 할인`}</li><li>{`상품금액 ${+(Number(cur.earn_rate)*100).toFixed(2)}% 포인트 적립`}</li></ul>
    <div className="customer-wallet-row"><div><span className="text-xs text-muted-foreground">사용 가능한 VELA 포인트</span><p className="text-lg font-semibold">{formatPoints(s.available)} <small className="text-xs text-muted-foreground">({usd(pointsToUsd(s.available,value))})</small></p><p className="text-xs text-muted-foreground">적립 대기 {formatPoints(s.pending)}</p></div><Button variant="goldOutline" onClick={onWallet}><Wallet/>내역 보기</Button></div>
    <div className="customer-wallet-row"><div><span className="text-xs text-muted-foreground">암호화폐 잔액</span><p className="text-sm">지갑 연결 대기</p></div><div className="flex gap-1"><Button variant="ghost" aria-disabled="true" onClick={()=>toast.info('암호화폐 입금 기능은 아직 연결되지 않았습니다.')}>입금</Button><Button variant="ghost" aria-disabled="true" onClick={()=>toast.info('암호화폐 출금 기능은 아직 연결되지 않았습니다.')}>출금</Button></div></div><p className="text-xs text-muted-foreground mt-2">포인트는 암호화폐가 아니며 현금화·출금할 수 없습니다.</p>
  </section>;
}

export function VelaWallet() {
  const { uid, data: s, isLoading } = useLoyaltySummary(); const value = Number(useLoyaltyRules().data?.config?.point_value_usd ?? 0.001);
  const history = useQuery({ queryKey: ['point-history', uid], enabled: !!uid, queryFn: async () => {
    const { data, error } = await supabase.from('point_transactions').select('id,type,amount,balance_after,expires_at,created_at,order_id,note').eq('user_id', uid!).order('created_at', { ascending: false }).limit(100);
    if (error) throw error; return data ?? [];
  } });
  if (!uid) return <p className="my-6 text-sm text-muted-foreground">로그인하면 VELA Wallet을 확인할 수 있습니다.</p>;
  if (isLoading || !s) return <p className="my-6 text-sm text-muted-foreground">불러오는 중…</p>;
  const days = daysUntil(s.expiring_at);
  const stats: [string, number, typeof Coins][] = [['Current Balance', s.available, Coins], ['Pending Points', s.pending, Hourglass], ['Expiring Soon', s.expiring_soon, AlertTriangle], ['Lifetime Earned', s.lifetime_earned, TrendingUp], ['Lifetime Used', s.lifetime_redeemed, Gift]];
  return <div className="mt-4">
    <p className="text-sm text-muted-foreground">구매 → 포인트 적립 → 다음 구매에서 사용. VELA의 모든 스토어에서 함께 쓰는 포인트입니다.</p>
    <div className="dashboard-stats mt-4">{stats.map(([l, v, I]) => <div className="stat-item" key={l}><I size={18}/><span>{l}</span><strong data-no-translate>{formatPoints(v)}</strong><small data-no-translate>{usd(pointsToUsd(v, value))}</small></div>)}</div>
    {s.expiring_soon > 0 && <p className="mt-3 text-sm text-primary" data-no-translate>{formatPoints(s.expiring_soon)} expires in {days} days</p>}
    <p className="mt-2 text-xs text-muted-foreground">Pending Points는 구매 확정(수령 확인) 후 지급됩니다. 포인트는 적립일로부터 유효기간이 지나면 만료되며, 현금화·양도할 수 없습니다.</p>
    <div className="section-heading mt-6"><h2>Transaction History</h2></div>
    {!history.data?.length ? <p className="text-sm text-muted-foreground">아직 포인트 내역이 없습니다.</p> :
      <div className="management-list">{history.data.map(h => <div className="management-row" key={h.id}><div className="min-w-0"><strong>{typeLabel[h.type] ?? h.type}</strong><small data-no-translate>{new Date(h.created_at).toLocaleDateString()}{h.expires_at ? ` · ~${new Date(h.expires_at).toLocaleDateString()}` : ''}</small></div><strong className={h.amount > 0 ? 'text-primary' : ''} data-no-translate>{h.amount > 0 ? '+' : ''}{formatPoints(h.amount)}</strong><small data-no-translate>{formatPoints(h.balance_after)}</small></div>)}</div>}
  </div>;
}

/** Product page: points this purchase would earn at the buyer's current tier. */
export function EarnHint({ price }: { price: number }) {
  const { uid, data: s } = useLoyaltySummary(); const rules = useLoyaltyRules().data;
  if (!rules || !rules.config?.points_enabled || !(price > 0)) return null;
  const value = Number(rules.config.point_value_usd), maxRate = Number(rules.config.max_earn_rate_pct) / 100;
  const rateFor = (tier?: string) => Math.min(Number(rules.tiers.find(t => t.tier === tier)?.earn_rate ?? 0), maxRate);
  const top = Math.max(...rules.tiers.map(t => Math.min(Number(t.earn_rate), maxRate)));
  const pts = uid && s ? earnPoints(price, rateFor(s.tier), value) : earnPoints(price, top, value);
  return <p className="mt-2 flex items-center gap-1 text-xs text-primary"><Coins size={14}/>{uid && s ? <>You will earn <strong data-no-translate>{formatPoints(pts)}</strong> with this purchase</> : <>Earn up to <strong data-no-translate>{formatPoints(pts)}</strong></>}</p>;
}

/** Checkout: choose how many VELA Points to apply (max % of product subtotal). */
export function CheckoutPoints({ product, points, onChange }: { product: number; points: number; onChange: (p: number) => void }) {
  const { uid, data: s } = useLoyaltySummary(); const cfg = useLoyaltyRules().data?.config;
  if (!uid || !s || !cfg) return null;
  const value = Number(cfg.point_value_usd), pct = Number(cfg.max_redemption_pct);
  const max = maxRedeemPoints(product, s.available, pct, value);
  return <section className="mt-5 rounded-md border border-border p-4" aria-label="VELA Points">
    <h3 className="text-sm font-semibold">VELA Points</h3>
    <p className="mt-1 text-xs text-muted-foreground">Available: <span data-no-translate>{formatPointsUsd(s.available, value)}</span></p>
    {!cfg.points_enabled ? <p className="mt-2 text-xs text-muted-foreground">포인트 사용이 일시 중지되었습니다.</p> : <>
      <div className="mt-3 flex gap-2"><input className="form-input" inputMode="numeric" aria-label="Use points" value={points || ''} placeholder="0" onChange={e => onChange(clampRedeem(Number(e.target.value.replace(/\D/g, '')), product, s.available, pct, value))}/>
        <Button type="button" variant="goldOutline" disabled={!max} onClick={() => onChange(points === max ? 0 : max)}>{points === max && max ? 'Clear' : 'Use Points'}</Button></div>
      <p className="mt-2 text-xs text-muted-foreground">최대 상품금액의 {pct}% (<span data-no-translate>{formatPoints(max)}</span>)까지 사용 가능 · 보험료·배송비·세금에는 사용 불가</p>
    </>}
  </section>;
}

export function CheckoutSummary({ product, insurance, total, points }: { product: number; insurance: number; total: number; points: number }) {
  const value = Number(useLoyaltyRules().data?.config?.point_value_usd ?? 0.001), discount = pointsToUsd(points, value);
  return <dl className="insurance-breakdown mt-4" aria-label="Order Summary">
    <div><dt>Product Subtotal</dt><dd data-no-translate>{usd(product)}</dd></div>
    <div><dt>Insurance</dt><dd data-no-translate>{usd(insurance)}</dd></div>
    <div><dt>Shipping</dt><dd>판매자 안내</dd></div>
    <div><dt>Taxes / Duties</dt><dd>수령국 기준</dd></div>
    {points > 0 && <><div><dt>Use Points</dt><dd data-no-translate>-{formatPoints(points)}</dd></div><div><dt>Points Discount</dt><dd className="text-primary" data-no-translate>-{usd(discount)}</dd></div></>}
    <div className="insurance-total"><dt>Cash Payment</dt><dd data-no-translate>{usd(Math.round((total - discount) * 100) / 100)}</dd></div>
  </dl>;
}

type Overview = { issued: number; redeemed: number; expired: number; outstanding: number; pending: number; point_value: number; monthly_cost_points: number; monthly_budget: number; monthly_budget_cap: number; customers: number;
  tiers: { tier: string; customers: number; avg_spend: number; avg_earned: number; avg_redeemed: number; cost_usd: number }[];
  alerts: { user_id: string; points: number }[]; recent: { id: string; user_id: string; type: string; amount: number; balance_after: number; source: string; created_at: string }[];
  audit: { id: string; action: string; target_user_id: string | null; details: Record<string, unknown>; created_at: string }[] };

export function AdminLoyalty() {
  const qc = useQueryClient();
  const ov = useQuery({ queryKey: ['loyalty-admin'], queryFn: async () => { const { data, error } = await supabase.rpc('loyalty_admin_overview'); if (error) throw error; return data as unknown as Overview; } });
  const rules = useLoyaltyRules();
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['loyalty-admin'] }); void qc.invalidateQueries({ queryKey: ['loyalty-rules'] }); };
  if (ov.isLoading) return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  if (ov.error || !ov.data) return <p className="text-sm text-muted-foreground">관리자 계정으로 로그인하면 포인트 현황을 볼 수 있습니다.</p>;
  const o = ov.data, v = Number(o.point_value);
  const redemptionRate = o.issued ? Math.round(o.redeemed / o.issued * 1000) / 10 : 0;
  const metrics: [string, string][] = [
    ['Total Points Issued', formatPoints(o.issued)], ['Total Points Redeemed', formatPoints(o.redeemed)], ['Total Points Expired', formatPoints(o.expired)],
    ['Outstanding Points', formatPoints(o.outstanding)], ['Pending Points', formatPoints(o.pending)], ['Estimated Point Liability', usd((o.outstanding + o.pending) * v)],
    ['Monthly Point Cost', usd(o.monthly_cost_points * v)], ['Monthly Loyalty Budget', usd(Number(o.monthly_budget))], ['Redemption Rate', `${redemptionRate}%`],
    ['Average Points per Customer', formatPoints(o.customers ? o.issued / o.customers : 0)],
  ];
  return <div>
    <div className="sample-notice">결제 시스템 연결 전 단계입니다. 포인트는 관리자 결제 확인 → 구매 확정 흐름에서만 움직이며, 실제 운영 전 각국 법규·회계 기준 검토가 필요합니다.</div>
    <div className="dashboard-stats">{metrics.map(([l, val]) => <div className="stat-item" key={l}><Coins size={18}/><span>{l}</span><strong data-no-translate>{val}</strong></div>)}</div>
    <div className="section-heading mt-6"><h2>등급별 분석</h2></div>
    <div className="management-list">{o.tiers.map(t => <div className="management-row" key={t.tier}><div><strong data-no-translate>{icons[t.tier]} {t.tier.toUpperCase()} Customers</strong><small data-no-translate>{t.customers}명 · 평균 구매 {usd(Number(t.avg_spend))}</small></div><small data-no-translate>평균 적립 {formatPoints(Number(t.avg_earned))} · 평균 사용 {formatPoints(Number(t.avg_redeemed))}</small><strong data-no-translate>{usd(Number(t.cost_usd))}</strong></div>)}</div>
    {o.alerts.length > 0 && <><div className="section-heading mt-6"><h2>비정상 대량 적립 감지</h2><span>30일 50만 P 이상</span></div><div className="management-list">{o.alerts.map(a => <div className="management-row" key={a.user_id}><AlertTriangle className="text-primary"/><small data-no-translate>{a.user_id}</small><strong data-no-translate>{formatPoints(a.points)}</strong></div>)}</div></>}
    {rules.data && <LoyaltySettingsForm rules={rules.data} onSaved={refresh}/>}
    <OrderPointTools onDone={refresh}/>
    <AdjustForm onDone={refresh}/>
    <div className="section-heading mt-6"><h2>최근 포인트 원장</h2></div>
    <div className="management-list">{o.recent.length ? o.recent.map(r => <div className="management-row" key={r.id}><div className="min-w-0"><strong>{typeLabel[r.type] ?? r.type}</strong><small className="break-all" data-no-translate>{r.user_id} · {r.source} · {new Date(r.created_at).toLocaleString()}</small></div><strong data-no-translate>{r.amount > 0 ? '+' : ''}{formatPoints(r.amount)}</strong><small data-no-translate>→ {formatPoints(r.balance_after)}</small></div>) : <p className="text-sm text-muted-foreground">아직 거래가 없습니다.</p>}</div>
    <div className="section-heading mt-6"><h2>Audit Log</h2></div>
    <div className="management-list">{o.audit.length ? o.audit.map(a => <div className="management-row" key={a.id}><div className="min-w-0"><strong>{a.action}</strong><small className="break-all" data-no-translate>{new Date(a.created_at).toLocaleString()} {a.target_user_id ?? ''} {typeof a.details?.['reason'] === 'string' ? `· ${a.details['reason']}` : ''}</small></div></div>) : <p className="text-sm text-muted-foreground">기록이 없습니다.</p>}</div>
  </div>;
}

type Rules = NonNullable<ReturnType<typeof useLoyaltyRules>['data']>;
function LoyaltySettingsForm({ rules, onSaved }: { rules: Rules; onSaved: () => void }) {
  const [rates, setRates] = useState(() => Object.fromEntries(rules.tiers.map(t => [t.tier, String(+(Number(t.earn_rate) * 100).toFixed(3))])));
  const c = rules.config;
  const [cfg, setCfg] = useState(() => ({ max_redemption_pct: String(c?.max_redemption_pct ?? 20), expiration_months: String(c?.expiration_months ?? 12), commission_rate_pct: String(c?.commission_rate_pct ?? 10), loyalty_budget_pct: String(c?.loyalty_budget_pct ?? 30), max_earn_rate_pct: String(c?.max_earn_rate_pct ?? 3), monthly_point_budget_usd: String(c?.monthly_point_budget_usd ?? 0), max_outstanding_liability_usd: String(c?.max_outstanding_liability_usd ?? 0), points_enabled: c?.points_enabled ?? true }));
  const save = async () => {
    for (const t of rules.tiers) { const r = Number(rates[t.tier]) / 100; if (r !== Number(t.earn_rate)) { const { error } = await supabase.from('loyalty_settings').update({ earn_rate: r }).eq('tier', t.tier); if (error) return toast.error(error.message); } }
    const { error } = await supabase.from('loyalty_config').update({ max_redemption_pct: Number(cfg.max_redemption_pct), expiration_months: Number(cfg.expiration_months), commission_rate_pct: Number(cfg.commission_rate_pct), loyalty_budget_pct: Number(cfg.loyalty_budget_pct), max_earn_rate_pct: Number(cfg.max_earn_rate_pct), monthly_point_budget_usd: Number(cfg.monthly_point_budget_usd), max_outstanding_liability_usd: Number(cfg.max_outstanding_liability_usd), points_enabled: cfg.points_enabled }).eq('id', 1);
    if (error) return toast.error(error.message);
    toast.success('설정을 저장했습니다. 새 주문부터 적용됩니다.'); onSaved(); return undefined;
  };
  const field = (k: Exclude<keyof typeof cfg, 'points_enabled'>, label: string) => <label key={k} className="grid gap-1 text-xs"><span>{label}</span><input className="form-input" inputMode="decimal" value={cfg[k]} onChange={e => setCfg(p => ({ ...p, [k]: e.target.value }))}/></label>;
  return <section className="mt-6">
    <div className="section-heading"><h2>Loyalty Settings</h2><span>새 주문부터 적용 · 기존 거래 불변</span></div>
    <h3 className="text-sm font-semibold">Membership 적립률 (%)</h3>
    <div className="mt-2 grid grid-cols-2 gap-3">{rules.tiers.map(t => <label key={t.tier} className="grid gap-1 text-xs"><span data-no-translate>{t.tier.toUpperCase()}</span><input className="form-input" inputMode="decimal" value={rates[t.tier]} onChange={e => setRates(p => ({ ...p, [t.tier]: e.target.value }))}/></label>)}</div>
    <h3 className="mt-4 text-sm font-semibold">Point Rules · 1P = <span data-no-translate>${Number(c?.point_value_usd ?? 0.001)}</span></h3>
    <div className="mt-2 grid grid-cols-2 gap-3">
      {field('max_redemption_pct', 'Maximum Redemption % (≤20)')}{field('expiration_months', 'Point Expiration (months)')}
      {field('commission_rate_pct', 'Commission Rate %')}{field('loyalty_budget_pct', 'Loyalty Budget % of commission')}
      {field('max_earn_rate_pct', 'Maximum Earn Rate %')}{field('monthly_point_budget_usd', 'Monthly Point Budget USD (0 = 무제한)')}
      {field('max_outstanding_liability_usd', 'Max Outstanding Liability USD (0 = 무제한)')}
    </div>
    <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={!cfg.points_enabled} onChange={e => setCfg(p => ({ ...p, points_enabled: !e.target.checked }))}/>Emergency Point OFF (적립·사용 중지)</label>
    <Button variant="gold" className="mt-4" onClick={() => void save()}><ShieldCheck/>설정 저장</Button>
  </section>;
}

function OrderPointTools({ onDone }: { onDone: () => void }) {
  const [no, setNo] = useState(''); const [refund, setRefund] = useState('');
  const run = async (kind: 'cancel' | 'refund') => {
    const patch = kind === 'cancel' ? { cancelled_at: new Date().toISOString() } : { refunded_amount_usd: Number(refund) };
    if (kind === 'refund' && !(Number(refund) > 0)) return toast.error('환불 누적 금액을 입력하세요.');
    if (!confirm(kind === 'cancel' ? '주문을 취소하고 포인트를 복구/회수할까요?' : '환불 금액을 기록하고 적립 포인트를 재계산할까요?')) return;
    const { data, error } = await supabase.from('orders').update(patch).eq('order_no', no.trim()).select('id');
    if (error) return toast.error(error.message);
    if (!data?.length) return toast.error('주문을 찾을 수 없습니다.');
    toast.success('처리했습니다.'); onDone(); return undefined;
  };
  return <section className="mt-6"><div className="section-heading"><h2>주문 취소 · 환불 포인트 처리</h2></div>
    <div className="grid gap-2"><input className="form-input" placeholder="주문번호" value={no} onChange={e => setNo(e.target.value)} data-no-translate/>
      <div className="flex gap-2"><input className="form-input" inputMode="decimal" placeholder="누적 환불 금액 USD" value={refund} onChange={e => setRefund(e.target.value)}/><Button variant="goldOutline" disabled={!no.trim()} onClick={() => void run('refund')}>부분 환불</Button></div>
      <Button variant="destructive" disabled={!no.trim()} onClick={() => void run('cancel')}>주문 취소</Button></div></section>;
}

function AdjustForm({ onDone }: { onDone: () => void }) {
  const [who, setWho] = useState(''); const [pts, setPts] = useState(''); const [reason, setReason] = useState(''); const [bonus, setBonus] = useState(false);
  const submit = async () => {
    let id = who.trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) { const { data } = await supabase.from('profiles').select('user_id').eq('system_code', id).maybeSingle(); if (!data) return toast.error('사용자를 찾을 수 없습니다.'); id = data.user_id; }
    const { error } = await supabase.rpc('loyalty_admin_adjust', { _user: id, _points: Math.trunc(Number(pts)), _reason: reason, _bonus: bonus });
    if (error) return toast.error(error.message);
    toast.success('조정했습니다. Audit Log에 기록되었습니다.'); setPts(''); setReason(''); onDone(); return undefined;
  };
  return <section className="mt-6"><div className="section-heading"><h2>수동 포인트 조정</h2><span>사유 필수 · 감사 기록</span></div>
    <div className="grid gap-2"><input className="form-input" placeholder="시스템 ID 또는 사용자 ID" value={who} onChange={e => setWho(e.target.value)} data-no-translate/>
      <input className="form-input" inputMode="numeric" placeholder="포인트 (차감은 음수)" value={pts} onChange={e => setPts(e.target.value)}/>
      <input className="form-input" placeholder="사유" maxLength={300} value={reason} onChange={e => setReason(e.target.value)}/>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={bonus} onChange={e => setBonus(e.target.checked)}/>BONUS로 기록</label>
      <Button variant="gold" disabled={!who.trim() || !Number(pts) || !reason.trim()} onClick={() => void submit()}>조정 실행</Button></div></section>;
}
