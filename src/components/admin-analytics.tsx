import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { addDays, delta, downloadCsv, ESCROW_LABEL, num, pct, STAGE_LABEL, todayKst, usd } from '@/lib/admin-analytics';

export const ANALYTICS_TAB_LABEL = '통계·분석';
export const ANALYTICS_SUBTITLE = '매출 · 회원 · 셀러 · 상품 · 트래픽 데이터를 한곳에서';

/* eslint-disable @typescript-eslint/no-explicit-any */
type A = Record<string, any>;
const SECTIONS = [['summary', '요약'], ['sales', '매출·거래'], ['members', '회원'], ['sellers', '셀러'], ['products', '상품'], ['engagement', '참여·콘텐츠'], ['ops', '운영 품질'], ['traffic', '트래픽'], ['risk', '보안·리스크']] as const;
type SectionKey = (typeof SECTIONS)[number][0];
const PRESETS = [['오늘', 0], ['7일', 6], ['30일', 29], ['90일', 89]] as const;
const COLORS = ['#d4af37', '#7aa2f7', '#9ece6a', '#f7768e', '#bb9af7', '#e0af68'];

function useMounted() { const [m, setM] = useState(false); useEffect(() => setM(true), []); return m; }

function Stat({ label, value, prev, cur, hint }: { label: string; value: string; prev?: number; cur?: number; hint?: string }) {
  const d = prev !== undefined && cur !== undefined ? delta(cur, prev) : null;
  return <div className="rounded-md border border-border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold text-primary">{value}</p>{d && <p className={`mt-1 text-xs ${d.tone === 'up' ? 'text-emerald-400' : d.tone === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>{d.text} <span className="text-muted-foreground">(직전 같은 기간 대비)</span></p>}{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>;
}
function Block({ title, children, csv, rows }: { title: string; children: ReactNode; csv?: string; rows?: Record<string, unknown>[] }) {
  return <section className="mt-6"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-base font-semibold">{title}</h3>{csv && rows && rows.length > 0 && <Button variant="ghost" size="sm" onClick={() => downloadCsv(csv, rows)}><Download size={14}/>CSV</Button>}</div>{children}</section>;
}
function Grid({ children }: { children: ReactNode }) { return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>; }
function Table({ cols, rows, empty = '데이터가 없습니다.' }: { cols: { key: string; label: string; render?: (row: A) => ReactNode; right?: boolean }[]; rows: A[]; empty?: string }) {
  if (!rows.length) return <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">{empty}</p>;
  return <div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[320px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{cols.map(c => <th key={c.key} className={`px-3 py-2 font-medium ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0">{cols.map(c => <td key={c.key} className={`px-3 py-2 ${c.right ? 'text-right tabular-nums' : ''}`}>{c.render ? c.render(r) : String(r[c.key] ?? '-')}</td>)}</tr>)}</tbody></table></div>;
}
function Notice({ section }: { section: A | undefined }) {
  if (!section?.error) return null;
  return <p role="alert" className="mt-4 rounded-md border border-destructive p-3 text-sm text-destructive">이 항목을 계산하지 못했습니다: {String(section.error)}</p>;
}
function Trend({ data, lines, money }: { data: A[]; lines: { key: string; name: string }[]; money?: boolean }) {
  const mounted = useMounted();
  if (!mounted) return <div className="h-64"/>;
  return <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#444"/><XAxis dataKey="d" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} minTickGap={24}/><YAxis tick={{ fontSize: 11 }} width={money ? 56 : 36} allowDecimals={false}/><Tooltip contentStyle={{ background: '#111', border: '1px solid #444' }} formatter={(v: unknown) => (money ? usd(Number(v)) : num(Number(v)))}/>{lines.length > 1 && <Legend/>}{lines.map((l, i) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={COLORS[i % COLORS.length] ?? '#d4af37'} strokeWidth={2} dot={false}/>)}</LineChart></ResponsiveContainer></div>;
}
function Bars({ data, x, y, name, money }: { data: A[]; x: string; y: string; name: string; money?: boolean }) {
  const mounted = useMounted();
  if (!mounted) return <div className="h-56"/>;
  if (!data.length) return <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">데이터가 없습니다.</p>;
  return <div className="h-56 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#444"/><XAxis dataKey={x} tick={{ fontSize: 11 }} interval={0} angle={data.length > 5 ? -25 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'} height={data.length > 5 ? 56 : 28}/><YAxis tick={{ fontSize: 11 }} width={money ? 56 : 36} allowDecimals={false}/><Tooltip contentStyle={{ background: '#111', border: '1px solid #444' }} formatter={(v: unknown) => (money ? usd(Number(v)) : num(Number(v)))}/><Bar dataKey={y} name={name} fill="#d4af37"/></BarChart></ResponsiveContainer></div>;
}
const slugOf = (id: string | null | undefined) => (id ? String(id).replace(/-/g, '').slice(0, 8) : '');
const ago = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

export function AdminAnalytics() {
  const [to, setTo] = useState(todayKst()), [from, setFrom] = useState(addDays(todayKst(), -29)), [preset, setPreset] = useState<number | null>(29), [tab, setTab] = useState<SectionKey>('summary');
  const q = useQuery({
    queryKey: ['admin-analytics', from, to],
    queryFn: async (): Promise<A> => {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc('admin_analytics', { _from: from, _to: to });
      if (error) throw new Error(error.message);
      return data as A;
    },
    placeholderData: prev => prev, refetchInterval: 60_000, retry: 1,
  });
  const d = q.data;
  const pick = (days: number) => { setPreset(days); setTo(todayKst()); setFrom(addDays(todayKst(), -days)); };
  const ov = d?.overview as A | undefined, pend = d?.pending as A | undefined, sales = d?.sales as A | undefined, mem = d?.members as A | undefined, sel = d?.sellers as A | undefined, prod = d?.products as A | undefined, eng = d?.engagement as A | undefined, ops = d?.ops as A | undefined, tr = d?.traffic as A | undefined, risk = d?.risk as A | undefined;
  const daily: A[] = Array.isArray(d?.daily) ? d?.daily : [];
  const csvName = (n: string) => `vela-${n}-${from}_${to}`;
  const admin = (section: string, extra?: Record<string, string>) => <Link to="/admin" search={{ role: 'admin', section, ...(extra as object) } as never} className="text-xs text-primary underline">바로 가기</Link>;

  return <div className="mt-4 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(([label, days]) => <Button key={label} size="sm" variant={preset === days ? 'goldOutline' : 'ghost'} onClick={() => pick(days)}>{label}</Button>)}
      <input type="date" aria-label="시작일" className="form-input !w-auto" value={from} max={to} onChange={e => { if (e.target.value) { setPreset(null); setFrom(e.target.value); } }}/>
      <span className="text-muted-foreground">~</span>
      <input type="date" aria-label="종료일" className="form-input !w-auto" value={to} min={from} max={todayKst()} onChange={e => { if (e.target.value) { setPreset(null); setTo(e.target.value); } }}/>
      <Button size="sm" variant="ghost" onClick={() => void q.refetch()} disabled={q.isFetching}><RefreshCw size={14} className={q.isFetching ? 'animate-spin' : ''}/>새로고침</Button>
      <Button size="sm" variant="ghost" onClick={() => downloadCsv(csvName('daily'), daily)} disabled={!daily.length}><Download size={14}/>일별 CSV</Button>
    </div>
    <p className="text-xs text-muted-foreground">기준: 한국시간 · 거래액은 결제 확인된 주문(취소 제외)의 금액 합계 · 1분마다 자동 갱신{d?.range?.generated_at ? ` · 계산 ${ago(d.range.generated_at)}` : ''}</p>
    <nav className="dashboard-tabs flex-wrap" aria-label="통계 구분">{SECTIONS.map(([key, label]) => <Button key={key} variant="ghost" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</Button>)}</nav>
    {q.isError && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">통계를 불러오지 못했습니다. DB 적용(DB적용_129차.sql)을 했는지 확인해 주세요. ({(q.error as Error).message})</p>}
    {q.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">통계를 계산하는 중…</p>}

    {d && tab === 'summary' && <>
      <Notice section={ov}/>
      <Grid>
        <Stat label="거래액(GMV)" value={usd(ov?.gmv)} cur={ov?.gmv} prev={ov?.gmv_prev}/>
        <Stat label="결제 확인 주문" value={`${num(ov?.orders_paid)}건`} cur={ov?.orders_paid} prev={ov?.orders_paid_prev}/>
        <Stat label="주문 접수" value={`${num(ov?.orders_placed)}건`} cur={ov?.orders_placed} prev={ov?.orders_placed_prev}/>
        <Stat label="신규 회원" value={`${num(ov?.new_members)}명`} cur={ov?.new_members} prev={ov?.new_members_prev}/>
        <Stat label="신규 셀러 신청" value={`${num(ov?.new_sellers)}명`} cur={ov?.new_sellers} prev={ov?.new_sellers_prev}/>
        <Stat label="신규 상품" value={`${num(ov?.new_posts)}개`} cur={ov?.new_posts} prev={ov?.new_posts_prev}/>
        <Stat label="방문자" value={`${num(ov?.visitors)}명`} cur={ov?.visitors} prev={ov?.visitors_prev} hint="방문 기록은 이 기능 적용 이후부터 쌓입니다"/>
        <Stat label="평균 주문 금액" value={usd(sales?.avg_order)}/>
      </Grid>
      <Block title="처리 대기 (지금 기준)"><Notice section={pend}/><Grid>
        <div className="rounded-md border border-border p-4"><p className="text-xs text-muted-foreground">입금 확인 대기</p><p className="mt-1 text-2xl font-semibold">{num(pend?.payments_pending)}<span className="ml-1 text-xs text-muted-foreground">(48시간 초과 {num(pend?.payments_pending_48h)})</span></p>{admin('crypto')}</div>
        <div className="rounded-md border border-border p-4"><p className="text-xs text-muted-foreground">QC 대기</p><p className="mt-1 text-2xl font-semibold">{num(pend?.qc_waiting)}</p>{admin('orders')}</div>
        <div className="rounded-md border border-border p-4"><p className="text-xs text-muted-foreground">분쟁 진행</p><p className="mt-1 text-2xl font-semibold">{num(pend?.disputes_open)}</p>{admin('disputes')}</div>
        <div className="rounded-md border border-border p-4"><p className="text-xs text-muted-foreground">셀러 승인 대기</p><p className="mt-1 text-2xl font-semibold">{num(pend?.seller_apps_pending)}</p>{admin('applications')}</div>
        <div className="rounded-md border border-border p-4"><p className="text-xs text-muted-foreground">답변 안 된 Q&A</p><p className="mt-1 text-2xl font-semibold">{num(pend?.unanswered_qna)}</p>{admin('boards', { boardTab: 'qna' })}</div>
        <div className="rounded-md border border-border p-4"><p className="text-xs text-muted-foreground">배송 14일 초과</p><p className="mt-1 text-2xl font-semibold">{num(pend?.shipping_delayed)}</p>{admin('orders')}</div>
      </Grid></Block>
      <Block title="거래액 추이" csv={csvName('daily')} rows={daily}><Trend data={daily} lines={[{ key: 'gmv', name: '거래액' }]} money/></Block>
      <Block title="주문·가입·상품 추이"><Trend data={daily} lines={[{ key: 'orders', name: '주문' }, { key: 'members', name: '가입' }, { key: 'posts', name: '상품' }, { key: 'visitors', name: '방문자' }]}/></Block>
    </>}

    {d && tab === 'sales' && <>
      <Notice section={sales}/>
      <Grid>
        <Stat label="거래액(GMV)" value={usd(ov?.gmv)} cur={ov?.gmv} prev={ov?.gmv_prev}/>
        <Stat label="평균 주문 금액" value={usd(sales?.avg_order)}/>
        <Stat label="취소율" value={`${sales?.cancel_rate ?? 0}%`} hint="기간 내 접수 주문 기준"/>
        <Stat label="환불 금액" value={usd(sales?.refunded)}/>
        <Stat label="상품 외 금액(보험 등)" value={usd(sales?.extra_usd)}/>
        <Stat label="포인트 할인 사용" value={usd(sales?.points_discount)}/>
        <Stat label="포인트 적립" value={`${num(sales?.points_earned)} P`}/>
      </Grid>
      <Block title="일별 거래액" csv={csvName('daily')} rows={daily}><Trend data={daily} lines={[{ key: 'gmv', name: '거래액' }]} money/></Block>
      <Block title="주문 단계별 현황" csv={csvName('stages')} rows={(sales?.stages ?? []).map((s: A) => ({ 단계: STAGE_LABEL[s.stage] ?? s.stage, 건수: s.n }))}><Bars data={(sales?.stages ?? []).map((s: A) => ({ name: STAGE_LABEL[s.stage] ?? s.stage, n: s.n }))} x="name" y="n" name="주문 수"/></Block>
      <Block title="에스크로 현황 (전체 누적)" csv={csvName('escrow')} rows={(sales?.escrow ?? []).map((s: A) => ({ 상태: ESCROW_LABEL[s.status] ?? s.status, 건수: s.n, 금액: s.usd }))}><Table cols={[{ key: 'status', label: '상태', render: r => ESCROW_LABEL[r.status] ?? r.status }, { key: 'n', label: '건수', right: true }, { key: 'usd', label: '금액', right: true, render: r => usd(r.usd) }]} rows={sales?.escrow ?? []}/></Block>
      <Block title="결제 수단(네트워크)별" csv={csvName('networks')} rows={sales?.networks ?? []}><Table cols={[{ key: 'network', label: '네트워크' }, { key: 'n', label: '건수', right: true }, { key: 'usd', label: '금액', right: true, render: r => usd(r.usd) }]} rows={sales?.networks ?? []}/></Block>
    </>}

    {d && tab === 'members' && <>
      <Notice section={mem}/>
      <Grid>
        <Stat label="전체 회원" value={`${num(mem?.total)}명`}/>
        <Stat label="신규 회원" value={`${num(ov?.new_members)}명`} cur={ov?.new_members} prev={ov?.new_members_prev}/>
        <Stat label="활성 회원 (7일)" value={`${num(mem?.active_7d)}명`} hint="주문·댓글·방문 기준"/>
        <Stat label="활성 회원 (30일)" value={`${num(mem?.active_30d)}명`}/>
        <Stat label="구매 경험 회원" value={`${num(mem?.buyers)}명`} hint={`전체의 ${pct(mem?.buyers ?? 0, mem?.total ?? 0)}`}/>
        <Stat label="재구매 회원" value={`${num(mem?.repeat_buyers)}명`} hint={`구매 회원의 ${pct(mem?.repeat_buyers ?? 0, mem?.buyers ?? 0)}`}/>
        <Stat label="가입→첫 주문 평균" value={`${mem?.avg_days_to_first_order ?? 0}일`}/>
        <Stat label="제재 중 / 기간 내 신규" value={`${num(d?.sanctions?.active)} / ${num(d?.sanctions?.new)}`}/>
      </Grid>
      <Block title="일별 신규 가입" csv={csvName('daily')} rows={daily}><Trend data={daily} lines={[{ key: 'members', name: '신규 가입' }]}/></Block>
      <Block title="멤버십 등급 분포" csv={csvName('tiers')} rows={mem?.tiers ?? []}><Table cols={[{ key: 'tier', label: '등급' }, { key: 'n', label: '회원 수', right: true }, { key: 'spend', label: '최근 12개월 구매액', right: true, render: r => usd(r.spend) }]} rows={mem?.tiers ?? []}/></Block>
      <Block title="권한별 계정 수"><Table cols={[{ key: 'role', label: '권한' }, { key: 'n', label: '계정 수', right: true }]} rows={mem?.roles ?? []}/></Block>
      <p className="mt-3 text-xs text-muted-foreground">회원 상세 관리는 <Link to="/admin" search={{ role: 'admin', section: 'members' } as never} className="text-primary underline">회원 관리</Link>에서 할 수 있어요.</p>
    </>}

    {d && tab === 'sellers' && <>
      <Notice section={sel}/>
      <Grid>
        <Stat label="신규 셀러 신청" value={`${num(ov?.new_sellers)}명`} cur={ov?.new_sellers} prev={ov?.new_sellers_prev}/>
        <Stat label="출고 속도 (결제→QC 업로드)" value={`${sel?.avg_ship_hours ?? 0}시간`} hint="평균"/>
        <Stat label="QC 진행 주문" value={`${num(sel?.qc_orders)}건`}/>
        <Stat label="QC 추가 사진 요청률" value={pct(sel?.qc_extra_orders ?? 0, sel?.qc_orders ?? 0)} hint={`${num(sel?.qc_extra_orders)}건`}/>
        <Stat label="30일 이상 업로드 없는 셀러" value={`${num(sel?.inactive_sellers)}명`}/>
      </Grid>
      <Block title="매출 상위 셀러 (기간 내)" csv={csvName('top-sellers')} rows={sel?.top_sales ?? []}><Table cols={[{ key: 'seller', label: '셀러', render: r => r.seller_id ? <Link to="/s/$slug" params={{ slug: slugOf(r.seller_id) }} className="text-primary underline">{r.seller}</Link> : r.seller }, { key: 'orders', label: '주문', right: true }, { key: 'gmv', label: '거래액', right: true, render: r => usd(r.gmv) }]} rows={sel?.top_sales ?? []}/></Block>
      <Block title="Q&A 답변율 · 평균 답변 시간 (기간 내 질문 많은 셀러)" csv={csvName('qna-response')} rows={sel?.qna_answer ?? []}><Table cols={[{ key: 'seller', label: '셀러' }, { key: 'asked', label: '질문', right: true }, { key: 'answered', label: '답변', right: true }, { key: 'rate', label: '답변율', right: true, render: r => pct(r.answered, r.asked) }, { key: 'avg_hours', label: '평균 답변(시간)', right: true }]} rows={sel?.qna_answer ?? []}/></Block>
      <Block title="팔로워 상위 셀러" csv={csvName('top-followers')} rows={sel?.top_followers ?? []}><Table cols={[{ key: 'seller', label: '셀러' }, { key: 'n', label: '팔로워', right: true }]} rows={sel?.top_followers ?? []}/></Block>
      <Block title="좋아요 상위 셀러" csv={csvName('top-likes')} rows={sel?.top_likes ?? []}><Table cols={[{ key: 'seller', label: '셀러' }, { key: 'n', label: '좋아요', right: true }]} rows={sel?.top_likes ?? []}/></Block>
      <Block title="셀러 계정 상태"><Table cols={[{ key: 'status', label: '상태' }, { key: 'n', label: '수', right: true }]} rows={sel?.by_status ?? []} empty="등록된 셀러 계정 정보가 없습니다."/></Block>
      <Block title="셀러 신청 현황"><Table cols={[{ key: 'status', label: '상태' }, { key: 'n', label: '수', right: true }]} rows={sel?.applications ?? []}/></Block>
      <Block title="스토어 등급 분포"><Table cols={[{ key: 'tier', label: '등급' }, { key: 'n', label: '스토어 수', right: true }]} rows={sel?.store_tiers ?? []}/></Block>
    </>}

    {d && tab === 'products' && <>
      <Notice section={prod}/>
      <Grid>
        <Stat label="전체 상품" value={`${num(prod?.total)}개`}/>
        <Stat label="신규 상품" value={`${num(ov?.new_posts)}개`} cur={ov?.new_posts} prev={ov?.new_posts_prev}/>
        <Stat label="품절" value={`${num(prod?.out_of_stock)}개`}/>
        <Stat label="영상(숏폼) 상품" value={`${num(eng?.shorts)}개`}/>
      </Grid>
      <Block title="카테고리별 성과 (누적)" csv={csvName('categories')} rows={prod?.by_category ?? []}><Table cols={[{ key: 'category', label: '카테고리' }, { key: 'posts', label: '상품', right: true }, { key: 'likes', label: '좋아요', right: true }, { key: 'saves', label: '저장', right: true }, { key: 'orders', label: '판매', right: true }, { key: 'gmv', label: '거래액', right: true, render: r => usd(r.gmv) }]} rows={prod?.by_category ?? []}/></Block>
      <Block title="인기 상품 TOP 10 (판매·좋아요 순)" csv={csvName('top-products')} rows={prod?.top_products ?? []}><Table cols={[{ key: 'title', label: '상품', render: r => <Link to="/post/$id" params={{ id: r.id }} className="text-primary underline">{r.title}</Link> }, { key: 'seller', label: '셀러' }, { key: 'likes', label: '좋아요', right: true }, { key: 'saves', label: '저장', right: true }, { key: 'orders', label: '판매', right: true }, { key: 'conv', label: '구매 전환(%)', right: true }]} rows={prod?.top_products ?? []}/></Block>
      <Block title="브랜드별 상품 수 TOP 10" csv={csvName('brands')} rows={prod?.top_brands ?? []}><Table cols={[{ key: 'brand', label: '브랜드' }, { key: 'posts', label: '상품', right: true }, { key: 'likes', label: '좋아요', right: true }]} rows={prod?.top_brands ?? []}/></Block>
      <Block title="가격대 분포"><Bars data={prod?.price_buckets ?? []} x="bucket" y="n" name="상품 수"/></Block>
      <Block title="영상 vs 사진 상품"><Table cols={[{ key: 'kind', label: '구분' }, { key: 'posts', label: '상품', right: true }, { key: 'likes', label: '좋아요', right: true }, { key: 'avg', label: '상품당 좋아요', right: true, render: r => (r.posts ? (r.likes / r.posts).toFixed(1) : '-') }]} rows={prod?.media ?? []}/></Block>
    </>}

    {d && tab === 'engagement' && <>
      <Notice section={eng}/>
      <Grid>
        <Stat label="Q&A (질문)" value={`${num(eng?.qna)}건`}/>
        <Stat label="댓글" value={`${num(eng?.comments)}건`}/>
        <Stat label="답변·답글" value={`${num(eng?.replies)}건`}/>
        <Stat label="리뷰" value={`${num(eng?.reviews)}건`} hint={`평균 평점 ${eng?.avg_rating ?? 0}`}/>
        <Stat label="신규 팔로우" value={`${num(eng?.follows_new)}건`} hint={`누적 ${num(eng?.follows_total)}`}/>
        <Stat label="좋아요 (누적)" value={num(eng?.likes_total)}/>
        <Stat label="저장 (누적)" value={num(eng?.saves_total)}/>
        <Stat label="셀러 공지" value={`${num(eng?.notices)}건`}/>
      </Grid>
      <Block title="상품 원문 언어 분포"><Table cols={[{ key: 'lang', label: '언어' }, { key: 'n', label: '상품', right: true }]} rows={eng?.source_langs ?? []}/></Block>
      <p className="mt-3 text-xs text-muted-foreground">영상 조회수는 방문 기록(트래픽)의 페이지 조회로 확인하세요. 게시판 상세는 <Link to="/admin" search={{ role: 'admin', section: 'boards' } as never} className="text-primary underline">게시판 관리</Link>에서 볼 수 있어요.</p>
    </>}

    {d && tab === 'ops' && <>
      <Notice section={ops}/>
      <Grid>
        <Stat label="신규 분쟁" value={`${num(ops?.disputes_new)}건`}/>
        <Stat label="진행 중 분쟁" value={`${num(ops?.disputes_open)}건`}/>
        <Stat label="배송 14일 초과" value={`${num(ops?.shipping_delayed)}건`}/>
        <Stat label="QC 추가 요청률" value={pct(sel?.qc_extra_orders ?? 0, sel?.qc_orders ?? 0)}/>
        <Stat label="알림 발송" value={`${num(ops?.notif_sent)}건`}/>
        <Stat label="알림 읽음률" value={pct(ops?.notif_read ?? 0, ops?.notif_sent ?? 0)}/>
      </Grid>
      <Block title="교환/불량 처리 현황"><Table cols={[{ key: 'status', label: '상태' }, { key: 'n', label: '건수', right: true }]} rows={ops?.replacements ?? []}/></Block>
      <Block title="교환/불량 사유" csv={csvName('replacement-reasons')} rows={ops?.replacement_reasons ?? []}><Table cols={[{ key: 'reason', label: '사유' }, { key: 'n', label: '건수', right: true }]} rows={ops?.replacement_reasons ?? []}/></Block>
      <Block title="택배사별 주문" csv={csvName('couriers')} rows={ops?.couriers ?? []}><Table cols={[{ key: 'courier', label: '택배사' }, { key: 'n', label: '건수', right: true }]} rows={ops?.couriers ?? []}/></Block>
      <Block title="알림 종류별 발송량"><Table cols={[{ key: 'kind', label: '종류' }, { key: 'n', label: '건수', right: true }]} rows={ops?.notif_kinds ?? []}/></Block>
    </>}

    {d && tab === 'traffic' && <>
      <Notice section={tr}/>
      <p className="rounded-md border border-border p-3 text-xs text-muted-foreground">방문 기록은 이 기능을 적용한 뒤부터 쌓입니다{tr?.first_tracked ? ` (첫 기록: ${ago(tr.first_tracked)})` : ' (아직 기록 없음)'}. 저장 항목: 임의 방문자 ID, 접속 경로, 기기, 언어, 검색어 (이름·연락처·IP는 저장하지 않음).</p>
      <Grid>
        <Stat label="방문자" value={`${num(tr?.visitors)}명`} cur={ov?.visitors} prev={ov?.visitors_prev}/>
        <Stat label="페이지뷰" value={num(tr?.views)}/>
        <Stat label="로그인 방문 회원" value={`${num(tr?.members_visiting)}명`}/>
        <Stat label="방문→가입 전환" value={pct(tr?.funnel?.signups ?? 0, tr?.funnel?.visitors ?? 0)}/>
      </Grid>
      <Block title="일별 방문자" csv={csvName('daily')} rows={daily}><Trend data={daily} lines={[{ key: 'visitors', name: '방문자' }]}/></Block>
      <Block title="전환 퍼널"><Table cols={[{ key: 'step', label: '단계' }, { key: 'n', label: '인원', right: true }, { key: 'rate', label: '첫 단계 대비', right: true }]} rows={[{ step: '방문', n: tr?.funnel?.visitors ?? 0 }, { step: '가입', n: tr?.funnel?.signups ?? 0 }, { step: '주문', n: tr?.funnel?.orders ?? 0 }, { step: '결제 확인', n: tr?.funnel?.paid ?? 0 }].map(r => ({ ...r, rate: pct(r.n, tr?.funnel?.visitors ?? 0) }))}/><p className="mt-1 text-xs text-muted-foreground">가입·주문은 방문 기록과 연결되지 않은 같은 기간 전체 인원이라 참고용입니다.</p></Block>
      <Block title="기기별 방문자"><Bars data={tr?.devices ?? []} x="device" y="n" name="방문자"/></Block>
      <Block title="언어별 방문자" csv={csvName('langs')} rows={tr?.langs ?? []}><Table cols={[{ key: 'lang', label: '언어' }, { key: 'n', label: '방문자', right: true }]} rows={tr?.langs ?? []}/></Block>
      <Block title="유입 경로" csv={csvName('referrers')} rows={tr?.referrers ?? []}><Table cols={[{ key: 'ref', label: '경로' }, { key: 'n', label: '방문자', right: true }]} rows={tr?.referrers ?? []}/></Block>
      <Block title="인기 페이지" csv={csvName('top-paths')} rows={tr?.top_paths ?? []}><Table cols={[{ key: 'path', label: '경로' }, { key: 'n', label: '조회', right: true }]} rows={tr?.top_paths ?? []}/></Block>
      <Block title="검색어 순위" csv={csvName('searches')} rows={tr?.searches ?? []}><Table cols={[{ key: 'term', label: '검색어' }, { key: 'n', label: '횟수', right: true }]} rows={tr?.searches ?? []}/></Block>
    </>}

    {d && tab === 'risk' && <>
      <Notice section={risk}/>
      <Grid>
        <Stat label="입금 거절" value={`${num(risk?.rejected_payments)}건`}/>
        <Stat label="환불 처리" value={`${num(risk?.refunded_payments)}건`}/>
        <Stat label="입금 대기 48시간 초과" value={`${num(risk?.pending_over_48h)}건`}/>
        <Stat label="제재 중 / 신규" value={`${num(d?.sanctions?.active)} / ${num(d?.sanctions?.new)}`}/>
      </Grid>
      <Block title="최근 관리 기록 (포인트·로열티)" csv={csvName('audit')} rows={(risk?.audit ?? []).map((a: A) => ({ 시각: ago(a.at), 작업: a.action, 관리자: a.actor, 대상: a.target }))}><Table cols={[{ key: 'at', label: '시각', render: r => ago(r.at) }, { key: 'action', label: '작업' }, { key: 'target', label: '대상 회원' }]} rows={risk?.audit ?? []} empty="기간 내 기록이 없습니다."/></Block>
      <p className="mt-3 text-xs text-muted-foreground">로그인 실패 횟수 등 인증 기록은 이 DB에서 수집하지 않아 포함하지 않았어요.</p>
    </>}
  </div>;
}
