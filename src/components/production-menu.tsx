import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Bookmark, ChevronRight, CircleDollarSign, Globe, Heart, LifeBuoy, LockKeyhole, Package, ShieldCheck, Sparkles, Store, Watch } from 'lucide-react';
import { Button } from './ui/button';
import { useCurrency } from './currency';
import { isLang, langLabels, langs } from '@/lib/i18n';
import { marketSearch } from '@/lib/market';
import type { z } from 'zod';
type Search=z.infer<typeof marketSearch>;
export function ProductionMenu({role,notifications}: {role:Search['role'];notifications?:ReactNode}) {
 const {currency,lang,setCurrency,setLang}=useCurrency();
 const groups=[
  {title:'둘러보기',items:[{label:'시계 컬렉션',to:'/market',search:{collection:'watches'},icon:Watch},{label:'액세서리 컬렉션',to:'/market',search:{collection:'accessories'},icon:Sparkles},{label:'추천 스튜디오 · 인기 셀러',to:'/store',search:{storeCategory:'top'},icon:Store}]},
  {title:'My VELA',items:[{label:'주문 내역 · 에스크로 · 배송 추적',to:'/me',search:{panel:'orders'},icon:Package},{label:'저장 상품 · 위시리스트',to:'/me',search:{panel:'wishlist'},icon:Bookmark},{label:'팔로잉 스튜디오',to:'/',search:{tab:'following'},icon:Heart}]},
  {title:'도움말 · 에스크로',items:[{label:'가상화폐 에스크로 이용 안내',to:'/escrow-guide',search:{},icon:ShieldCheck},{label:'1:1 지원 · 분쟁 센터',to:'/support',search:{},icon:LifeBuoy},{label:'개인정보 보호 · SHA-256',to:'/privacy',search:{},icon:LockKeyhole}]},
 ] satisfies {title:string;items:{label:string;to:'/'|'/market'|'/store'|'/me'|'/escrow-guide'|'/support'|'/privacy';search:Search;icon:typeof Watch}[]}[];
 return <div className="production-menu">{notifications&&<section className="border-b border-border py-4"><h2 className="mb-2 px-2 text-xs font-semibold text-primary">알림</h2>{notifications}</section>}<nav aria-label="VELA 메뉴">{groups.map(group=><section key={group.title} className="border-b border-border py-4"><h2 className="mb-2 px-2 text-xs font-semibold text-primary">{group.title}</h2><div className="grid gap-1">{group.items.map(item=><Button asChild variant="ghost" className="h-auto min-h-11 w-full justify-start gap-3 px-2 py-2 text-start text-sm" key={item.label}><Link to={item.to} search={{role,...item.search}}><item.icon className="size-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 whitespace-normal leading-5">{item.label}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground"/></Link></Button>)}</div></section>)}</nav>
 <section className="py-4"><h2 className="mb-3 px-2 text-xs font-semibold text-primary">환경설정</h2><label htmlFor="drawer-currency" className="mb-2 flex items-center gap-2 px-2 text-sm"><CircleDollarSign className="size-4 text-muted-foreground"/>표시 통화</label><select id="drawer-currency" className="form-input" value={currency==='USD'||currency==='USDT'?currency:''} onChange={e=>{if(e.target.value==='USD'||e.target.value==='USDT')setCurrency(e.target.value);}}>{currency!=='USD'&&currency!=='USDT'&&<option value="" disabled>{currency}</option>}<option value="USD">USD</option><option value="USDT">USDT</option></select>{currency==='USDT'&&<p className="mt-2 text-xs leading-5 text-muted-foreground">USDT 표시는 1 USD ≈ 1 USDT 기준의 예상 금액입니다.</p>}<label htmlFor="drawer-language" className="mb-2 mt-4 flex items-center gap-2 px-2 text-sm"><Globe className="size-4 text-muted-foreground"/>언어</label><select id="drawer-language" className="form-input" value={lang} onChange={e=>{if(isLang(e.target.value))setLang(e.target.value);}}>{langs.map(l=><option key={l} value={l}>{langLabels[l]}</option>)}</select></section></div>;
}
