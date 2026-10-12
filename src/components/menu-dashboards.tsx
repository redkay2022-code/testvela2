import { tx } from '@/lib/dom-translate';
import { useCurrency } from './currency';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { BarChart3, ChevronRight, ClipboardList, LayoutDashboard, MessageCircle, Package, Plus, ShieldCheck, Store, Trash2, Truck, Users, Wallet } from 'lucide-react';
import { Button } from './ui/button';
import { useMyAccount } from './seller-account';
import { supabase } from '@/integrations/supabase/client';
import { useSellerWorkflows } from '@/lib/use-seller-workflows';
import { formatMoney } from '@/lib/currency';

/**
 * Hamburger-menu dashboards.
 * An admin sees the platform summary + back-office shortcuts; an approved seller sees the studio summary + store shortcuts.
 * Everything is read-only here — the full tools stay on the dashboard pages the shortcuts open.
 */
const rpc = (name: string, args: object) => (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);
const dash = '—';

function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: string | undefined; tone?: 'alert' | undefined }) {
  const { lang } = useCurrency();
  return <div className={`rounded-lg border p-3 ${tone === 'alert' ? 'border-destructive/60' : 'border-border'}`}>
    <span className="block text-[11px] text-muted-foreground">{tx(label)}</span>
    <strong className={`block text-lg leading-7 ${tone === 'alert' ? 'text-destructive' : ''}`}>{value}</strong>
    {note && <small className="block text-[10px] leading-4 text-muted-foreground">{tx(note)}</small>}
  </div>;
}
type ShortcutProps = { icon: typeof Store; children: ReactNode; badge?: number; to: '/admin' | '/seller' | '/seller-store' | '/seller-messages' | '/upload'; search: Record<string, string> };
function Shortcut({ icon: Icon, children, badge, to, search }: ShortcutProps) {
  const { lang } = useCurrency();
  return <Button asChild variant="ghost" className="h-auto min-h-11 w-full justify-start gap-3 px-2 py-2 text-start text-sm">
    <Link to={to as '/admin'} search={search as never}><Icon className="size-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 whitespace-normal leading-5">{children}</span>{!!badge && <span className="rounded-full bg-destructive px-2 text-xs text-destructive-foreground">{badge > 99 ? '99+' : badge}</span>}<ChevronRight className="size-4 shrink-0 text-muted-foreground"/></Link>
  </Button>;
}
function useCount(key: string, table: string, filter: (q: any) => any) {
  return useQuery({ queryKey: [key], refetchInterval: 30_000, queryFn: async () => { const { count, error } = await filter(supabase.from(table as 'orders').select('id', { count: 'exact', head: true })); if (error) throw new Error(error.message); return (count ?? 0) as number; } });
}

type Traffic = { live: number; today_visitors: number; members: number; sanctioned: number };
function AdminBlock() {
  const traffic = useQuery({ queryKey: ['admin-traffic'], refetchInterval: 30_000, queryFn: async () => { const { data, error } = await rpc('admin_traffic_stats', { _days: 30 }); if (error) throw new Error(error.message); return data as Traffic | null; } });
  const apps = useCount('menu-pending-apps', 'seller_applications', q => q.eq('status', 'pending'));
  const open = useCount('menu-open-orders', 'orders', q => q.is('cancelled_at', null).neq('stage', 'delivered'));
  const disputes = useCount('menu-open-disputes', 'orders', q => q.eq('dispute_open', true));
  const t = traffic.data;
  return <section className="border-b border-border py-4" aria-label={tx("관리자 대시보드")}>
    <h2 className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-primary"><ShieldCheck className="size-4"/>{tx("관리자 대시보드")}</h2>
    <div className="grid grid-cols-2 gap-2 px-1">
      <Stat label="지금 접속자" value={t ? t.live : dash} note="최근 5분"/>
      <Stat label="오늘 방문자" value={t ? t.today_visitors : dash}/>
      <Stat label="전체 회원" value={t ? t.members : dash} note={t ? tx("제재 중 {0}명", { 0: t.sanctioned }) : undefined}/>
      <Stat label="승인 대기 셀러" value={apps.data ?? dash} tone={apps.data ? 'alert' : undefined}/>
      <Stat label="진행 중 주문" value={open.data ?? dash}/>
      <Stat label="분쟁 접수" value={disputes.data ?? dash} tone={disputes.data ? 'alert' : undefined}/>
    </div>
    {traffic.isError && <p className="mt-2 px-2 text-[11px] leading-4 text-muted-foreground">{tx("방문 통계는 DB 업데이트(0035)를 적용하면 표시됩니다.")}</p>}
    <div className="mt-2 grid gap-1">
      <Shortcut icon={LayoutDashboard} to="/admin" search={{ role: 'admin', section: 'dashboard' }}>{tx("대시보드 전체 보기")}</Shortcut>
      <Shortcut icon={ClipboardList} badge={apps.data ?? 0} to="/admin" search={{ role: 'admin', section: 'applications' }}>{tx("판매자 신청 승인")}</Shortcut>
      <Shortcut icon={Users} to="/admin" search={{ role: 'admin', section: 'members' }}>{tx("회원 관리 · 정지/추방")}</Shortcut>
      <Shortcut icon={Package} to="/admin" search={{ role: 'admin', section: 'products' }}>{tx("상품 관리")}</Shortcut>
      <Shortcut icon={Truck} badge={disputes.data ?? 0} to="/admin" search={{ role: 'admin', section: 'orders' }}>{tx("주문 · 분쟁 관리")}</Shortcut>
      <Shortcut icon={Trash2} to="/admin" search={{ role: 'admin', section: 'reset' }}>{tx("데이터 초기화")}</Shortcut>
    </div>
  </section>;
}

type SellerTraffic = { live: number; visitors: number; orders: number; conversion: number };
function SellerBlock({ user }: { user: User }) {
  const { lang } = useCurrency();
  const work = useSellerWorkflows(user.id);
  const products = useQuery({ queryKey: ['menu-my-products', user.id], queryFn: async () => { const { count, error } = await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id); if (error) throw new Error(error.message); return count ?? 0; } });
  const traffic = useQuery({ queryKey: ['menu-seller-traffic'], refetchInterval: 30_000, queryFn: async () => { const { data, error } = await rpc('seller_traffic_stats', { _days: 7 }); if (error) throw new Error(error.message); return data as SellerTraffic | null; } });
  const orders = work.data?.orders ?? [], todo = orders.filter(o => !o.cancelled_at && o.stage !== 'delivered').length, disputes = orders.filter(o => o.dispute_open && !o.cancelled_at).length;
  const questions = work.activity?.comments.length, followers = work.activity?.followers.length;
  const t = traffic.data;
  return <section className="border-b border-border py-4" aria-label={tx("셀러 대시보드")}>
    <h2 className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-primary"><Store className="size-4"/>{tx("셀러 대시보드")}</h2>
    <div className="grid grid-cols-2 gap-2 px-1">
      <Stat label="처리할 주문" value={work.data ? todo : dash} note="배송 완료 전" tone={todo ? 'alert' : undefined}/>
      <Stat label="분쟁 · 교환" value={work.data ? disputes : dash} tone={disputes ? 'alert' : undefined}/>
      <Stat label="고객 문의" value={questions ?? dash} note="답변 대기 포함"/>
      <Stat label="등록 상품" value={products.data ?? dash}/>
      <Stat label="입금 대기 (USD)" value={work.data ? formatMoney(work.data.escrow.pending, 'USD') : dash} note="구매 확정까지 보관"/>
      <Stat label="입금 완료 (USD)" value={work.data ? formatMoney(work.data.escrow.released, 'USD') : dash} note="에스크로 해제 누적"/>
      <Stat label="지금 방문 중" value={t ? t.live : dash} note="내 스토어 · 최근 5분"/>
      <Stat label="7일 방문자" value={t ? t.visitors : dash} note={t ? tx("신규 팔로워 {0}명", { 0: followers ?? 0 }) : undefined}/>
    </div>
    <div className="mt-2 grid gap-1">
      <Shortcut icon={LayoutDashboard} to="/seller" search={{ role: 'seller' }}>{tx("내 스튜디오 · 매출 분석")}</Shortcut>
      <Shortcut icon={Plus} to="/upload" search={{ role: 'seller' }}>{tx("상품 등록")}</Shortcut>
      <Shortcut icon={Store} to="/seller-store" search={{ role: 'seller' }}>{tx("스토어 관리")}</Shortcut>
      <Shortcut icon={Truck} badge={todo} to="/seller-store" search={{ role: 'seller', sellerView: 'shipping' }}>{tx("물류 · 배송 · 출고 검수")}</Shortcut>
      <Shortcut icon={MessageCircle} to="/seller-messages" search={{ role: 'seller' }}>{tx("메시지함 · 구매자 대화")}</Shortcut>
      <Shortcut icon={BarChart3} to="/seller-store" search={{ role: 'seller', sellerView: 'analytics' }}>{tx("방문자 분석")}</Shortcut>
      <Shortcut icon={Wallet} to="/seller" search={{ role: 'seller' }}>{tx("정산 · 지갑")}</Shortcut>
    </div>
  </section>;
}

export function MenuDashboards() {
  const { lang } = useCurrency();
  const auth = useQuery({ queryKey: ['auth-user'], queryFn: async () => (await supabase.auth.getUser()).data.user });
  const account = useMyAccount(auth.data ?? null);
  const roles = account.data?.roles ?? [];
  const user = auth.data;
  if (!user || !(roles.includes('admin') || roles.includes('seller'))) return null;
  return <div lang={lang} translate="no" className="notranslate" data-no-translate>{roles.includes('admin') && <AdminBlock/>}{roles.includes('seller') && <SellerBlock user={user}/>}</div>;
}
