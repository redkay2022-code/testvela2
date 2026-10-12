import { tx } from '@/lib/dom-translate';
import { useCurrency } from './currency';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Globe2, MousePointerClick, ShoppingBag, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Donut, LineChart, countryName, sourceName } from './mini-charts';

type Stats = {
  days: number; live: number; visitors: number; orders: number; conversion: number;
  daily: { d: string; views: number; visitors: number }[];
  top_products: { id: string; title: string; views: number; visitors: number; likes: number; inquiries: number }[];
  countries: { country: string; n: number }[]; sources: { source: string; n: number }[];
};
const rpc = (name: string, args: object) => (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);

/** Seller back-office: who visits my store, which products attract them, and how many visits turn into orders. */
export function SellerAnalytics() {
  const { lang } = useCurrency();
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['seller-traffic', days], refetchInterval: 30_000, queryFn: async () => {
    const { data, error } = await rpc('seller_traffic_stats', { _days: days });
    if (error) throw new Error(error.message);
    return data as Stats | null;
  } });
  const s = q.data;
  const totalViews = s?.daily.reduce((a, d) => a + d.views, 0) ?? 0;
  return <section className="seller-section" aria-label={tx("방문자 분석")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2>{tx("방문자 분석")}</h2>
      <div role="group" aria-label={tx("기간")} className="flex gap-1">{[7, 30, 90].map(d => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`rounded-full border px-3 py-1 text-xs ${days === d ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>{tx("{0}일", { 0: d })}</button>)}</div></div>
    {q.isError ? <p role="alert" className="mt-3 text-sm">{tx("통계를 불러오지 못했습니다. 관리자가 최신 DB 업데이트(0035)를 적용했는지 확인해 주세요.")}</p>
      : q.isLoading ? <p className="mt-3 text-sm">{tx("불러오는 중…")}</p>
      : !s ? <p className="mt-3 text-sm">{tx("셀러 계정으로 로그인해야 볼 수 있습니다.")}</p> : <>
      <div className="seller-social-grid mt-3">
        {([[Users, '지금 보고 있는 방문자', s.live, '최근 5분'], [Eye, '페이지 조회수', totalViews, tx("{0}일", { 0: s.days })], [Users, '순 방문자', s.visitors, `${s.days}일`], [ShoppingBag, '주문 수', s.orders, `${s.days}일`], [MousePointerClick, '구매 전환율', `${s.conversion}%`, '주문 ÷ 순 방문자']] as const).map(([Icon, label, value, note]) =>
          <div key={tx(label)} className="seller-social-card"><Icon/><span>{tx(label)}</span><strong>{value}</strong><small className="text-muted-foreground">{tx(note)}</small></div>)}
      </div>
      <h3 className="mt-6 text-sm font-semibold">{tx("방문 추이")}</h3>
      <LineChart label={tx('일별 조회수와 순 방문자')} labels={s.daily.map(d => d.d.slice(5))} series={[{ name: tx('조회수'), color: '#D4AF37', values: s.daily.map(d => d.views) }, { name: tx('순 방문자'), color: '#5B8DEF', values: s.daily.map(d => d.visitors) }]}/>
      <h3 className="mt-6 text-sm font-semibold">{tx("인기 상품 Top 5")}</h3>
      {s.top_products.length ? <ol className="mt-2 space-y-2">{s.top_products.map((p, i) => <li key={p.id} className="seller-thread-row"><span className="w-5 text-primary">{i + 1}</span><div className="min-w-0 flex-1"><strong className="block truncate">{p.title}</strong><small className="text-muted-foreground">{tx("조회")}{p.views} {tx("· 방문자")}{p.visitors} {tx("· 좋아요")}{p.likes} {tx("· 문의")}{p.inquiries}</small></div></li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">{tx("아직 조회된 상품이 없습니다.")}</p>}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Globe2 size={15}/>{tx("방문자 국가")}</h3><Donut label="국가별 방문자" items={s.countries.map(c => ({ label: countryName(c.country, lang), value: c.n }))}/></div>
        <div><h3 className="mb-2 text-sm font-semibold">{tx("유입 경로")}</h3><Donut label="유입 경로별 방문자" items={s.sources.map(c => ({ label: tx(sourceName(c.source)), value: c.n }))}/></div>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">{tx("방문 기록은 임의의 브라우저 ID로만 집계하며 IP·이름·전화번호는 저장하지 않습니다. 본인과 관리자의 방문은 제외됩니다. 국가는 접속 지역 기준입니다.")}</p>
    </>}
  </section>;
}
