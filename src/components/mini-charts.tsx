/** Small dependency-free SVG/CSS charts for the dashboards (Korean-only back-office UI). */
const GOLD = 'var(--primary, #D4AF37)';
const COLORS = ['#D4AF37', '#5B8DEF', '#3FB68B', '#E5735A', '#A678DE', '#E0B84C', '#6CC4D9', '#9AA0A6'];

export function BarsChart({ data, height = 120, label }: { data: { label: string; value: number }[]; height?: number; label: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const w = Math.max(240, data.length * 14);
  return <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
    {data.map((d, i) => { const bh = Math.round((d.value / max) * (height - 18)); const bw = w / data.length; return <g key={i}><title>{`${d.label}: ${d.value}`}</title><rect x={i * bw + 1.5} y={height - 14 - bh} width={Math.max(2, bw - 3)} height={Math.max(bh, d.value ? 2 : 0)} rx={2} fill={GOLD} opacity={0.9}/></g>; })}
    <line x1="0" x2={w} y1={height - 14} y2={height - 14} stroke="currentColor" opacity={0.2}/>
  </svg>;
}

export function LineChart({ series, labels, height = 130, label }: { series: { name: string; color: string; values: number[] }[]; labels: string[]; height?: number; label: string }) {
  const n = Math.max(2, labels.length), w = 320, pad = 6;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const pt = (v: number, i: number) => `${pad + (i * (w - pad * 2)) / (n - 1)},${height - 16 - (v / max) * (height - 28)}`;
  return <div><svg role="img" aria-label={label} viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
    <line x1="0" x2={w} y1={height - 16} y2={height - 16} stroke="currentColor" opacity={0.2}/>
    {series.map(s => <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" points={s.values.map((v, i) => pt(v, i)).join(' ')}/>)}
  </svg>
  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground"><span>{labels[0]}</span><span className="flex gap-3">{series.map(s => <span key={s.name}><i style={{ background: s.color }} className="mr-1 inline-block size-2 rounded-full"/>{s.name}</span>)}</span><span>{labels[labels.length - 1]}</span></div></div>;
}

export function Donut({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <p className="text-sm text-muted-foreground">아직 데이터가 없습니다.</p>;
  let acc = 0;
  const stops = items.map((it, i) => { const from = (acc / total) * 100; acc += it.value; return `${COLORS[i % COLORS.length]} ${from}% ${(acc / total) * 100}%`; }).join(', ');
  return <div className="flex items-center gap-4"><div role="img" aria-label={label} className="relative size-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }}><div className="absolute inset-4 rounded-full bg-card"/></div>
    <ul className="min-w-0 flex-1 space-y-1 text-sm">{items.map((it, i) => <li key={it.label} className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 truncate"><i style={{ background: COLORS[i % COLORS.length] }} className="size-2.5 shrink-0 rounded-full"/>{it.label}</span><span className="shrink-0 text-muted-foreground">{Math.round((it.value / total) * 100)}% · {it.value}</span></li>)}</ul></div>;
}

const regionNames = (() => { try { return new Intl.DisplayNames(['ko'], { type: 'region' }); } catch { return null; } })();
export const countryName = (code: string) => code === 'ZZ' ? '알 수 없음' : (() => { try { return regionNames?.of(code) ?? code; } catch { return code; } })() ?? code;
const SOURCE_NAMES: Record<string, string> = { direct: '직접 접속', feed: '메인 피드', search: '검색', category: '카테고리', shorts: '쇼츠', store: '스토어', internal: '사이트 내부', external: '외부 링크', instagram: '인스타그램', telegram: '텔레그램', facebook: '페이스북', x: 'X(트위터)', google: '구글', youtube: '유튜브', wechat: '위챗', naver: '네이버', bing: '빙' };
export const sourceName = (s: string) => SOURCE_NAMES[s] ?? s;
