import {useEffect,useMemo,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {motion,useReducedMotion} from 'motion/react';
import {Check,ChevronDown,Search,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {brandGroupByCategory,categoryLabel,pickerCategoryOf,primaryCategories,productCategoryItems,viewCategoryIds} from '@/lib/feed-categories';
import {tx} from '@/lib/dom-translate';
import {Tx} from './tx';

const BRAND_FOLD=12;
const ALL_LABEL:Record<string,string>={watches:'시계 전체',accessories:'악세사리 전체'};
type Item=readonly [string,string];
const viewItems:readonly Item[]=primaryCategories.filter(item=>viewCategoryIds.includes(item[0]));
const chipBase='notranslate inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs leading-none transition-colors';
const chipClass=(on:boolean)=>`${chipBase} ${on?'border-primary bg-accent font-semibold text-primary':'border-border bg-card text-foreground hover:border-primary/60'}`;

export function FeedCategoryPicker({selected='recommend',open,onOpen,onClose,onSelect}:{selected?:string|undefined;open:boolean;onOpen:()=>void;onClose:()=>void;onSelect:(id:string)=>void}){
 const reduced=useReducedMotion(),bar=useRef<HTMLDivElement>(null);
 const chips:readonly Item[]=primaryCategories.some(item=>item[0]===selected)?primaryCategories:[...primaryCategories,[selected,categoryLabel(selected)]];
 useEffect(()=>{bar.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced?'auto':'smooth'});},[selected,reduced]);
 return <><div className="vela-category-row"><nav className="red-home-subtabs notranslate" translate="no" aria-label="Home categories" ref={bar}>{chips.map(([id,label])=><Button key={id} variant="ghost" className={`red-home-subtab notranslate ${selected===id?'active':''}`} translate="no" aria-pressed={selected===id} onClick={()=>onSelect(id)}><Tx>{label}</Tx></Button>)}</nav><Button variant="ghost" size="icon" className="vela-category-expand" aria-label="All categories" aria-expanded={open} onClick={onOpen}><ChevronDown/></Button></div>
 <Dialog.Root open={open} onOpenChange={value=>{if(!value)onClose();}}><Dialog.Portal><Dialog.Overlay className="lux-backdrop overlay-front"/><Dialog.Content asChild aria-describedby={undefined}><motion.section className="vela-category-sheet notranslate" translate="no" initial={{y:reduced?0:24,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:reduced?0:.2}}><PickerBody selected={selected} onClose={onClose} onSelect={onSelect}/></motion.section></Dialog.Content></Dialog.Portal></Dialog.Root></>;
}

function PickerBody({selected,onClose,onSelect}:{selected:string;onClose:()=>void;onSelect:(id:string)=>void}){
 const [tab,setTab]=useState<string>(()=>pickerCategoryOf(selected) ?? 'watches'),[query,setQuery]=useState(''),[more,setMore]=useState(false);
 const brands=brandGroupByCategory[tab];
 const q=query.trim().toLowerCase();
 const found=useMemo<Item[]>(()=>{
  if(!q)return [];
  const all:Item[]=[...viewItems,...productCategoryItems,...Object.values(brandGroupByCategory).flatMap(g=>g.items)];
  const seen=new Set<string>();
  return all.filter(([id,label])=>!seen.has(id)&&(seen.add(id),label.toLowerCase().includes(q)||tx(label).toLowerCase().includes(q)||id.includes(q)));
 },[q]);
 const brandItems=brands?(more||brands.items.length<=BRAND_FOLD?brands.items:brands.items.slice(0,BRAND_FOLD)):[];
 return <>
  <div className="sticky top-0 z-10 -mx-5 -mt-4 border-b border-border bg-background px-5 pb-3 pt-4">
   <div className="vela-category-sheet-header"><Dialog.Title><Tx>전체 카테고리</Tx></Dialog.Title><Button variant="ghost" size="icon" aria-label="Close categories" onClick={onClose}><X/></Button></div>
   <label className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm focus-within:border-primary"><Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true"/><input type="search" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" placeholder={tx('카테고리·브랜드 검색')} aria-label={tx('카테고리·브랜드 검색')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
  </div>
  {q?<section className="pt-4" aria-live="polite">
    {found.length?<div className="flex flex-wrap gap-2">{found.map(([id,label])=><Button key={id} variant="ghost" translate="no" className={chipClass(selected===id)} aria-pressed={selected===id} onClick={()=>onSelect(id)}><Tx>{label}</Tx>{selected===id&&<Check size={12}/>}</Button>)}</div>
     :<p className="py-6 text-center text-sm text-muted-foreground"><Tx>검색 결과가 없습니다.</Tx></p>}
  </section>:<>
  <section className="pt-4"><h2 className="mb-2 text-xs font-semibold text-muted-foreground"><Tx>보기</Tx></h2>
   <div className="flex flex-wrap gap-2">{viewItems.map(([id,label])=><Button key={id} variant="ghost" translate="no" className={chipClass(selected===id)} aria-pressed={selected===id} onClick={()=>onSelect(id)}><Tx>{label}</Tx>{selected===id&&<Check size={12}/>}</Button>)}</div></section>
  <section className="mt-5 border-t border-border pt-4"><h2 className="mb-2 text-xs font-semibold text-muted-foreground"><Tx>상품 카테고리</Tx></h2>
   <div className="flex flex-wrap gap-2" role="tablist" aria-label={tx('상품 카테고리')}>{productCategoryItems.map(([id,label])=>{const hasBrands=Boolean(brandGroupByCategory[id]),on=tab===id;
    return <Button key={id} variant="ghost" translate="no" role="tab" aria-selected={on} className={chipClass(on||selected===id)} onClick={()=>{if(hasBrands){setTab(id);setMore(false);}else onSelect(id);}}><Tx>{label}</Tx>{hasBrands?<ChevronDown size={12} className={on?'rotate-180':''} aria-hidden="true"/>:selected===id&&<Check size={12}/>}</Button>;})}</div>
   {brands&&<div className="mt-4 rounded-lg border border-border bg-card/40 p-3" role="tabpanel">
     <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-muted-foreground"><Tx>{brands.label}</Tx></h3></div>
     <div className="flex flex-wrap gap-2">
      <Button variant="ghost" translate="no" className={chipClass(selected===tab)} aria-pressed={selected===tab} onClick={()=>onSelect(tab)}><Tx>{ALL_LABEL[tab] ?? '전체'}</Tx>{selected===tab&&<Check size={12}/>}</Button>
      {brandItems.map(([id,label])=><Button key={id} variant="ghost" translate="no" className={chipClass(selected===id)} aria-pressed={selected===id} onClick={()=>onSelect(id)}><Tx>{label}</Tx>{selected===id&&<Check size={12}/>}</Button>)}
      {brands.items.length>BRAND_FOLD&&!more&&<Button variant="ghost" className={`${chipBase} border-dashed border-border text-muted-foreground`} onClick={()=>setMore(true)}><Tx>더보기</Tx></Button>}
     </div></div>}
  </section></>}
  {selected!=='recommend'&&<div className="mt-5 flex justify-end border-t border-border pt-3"><Button variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={()=>onSelect('recommend')}><Tx>필터 초기화</Tx></Button></div>}
 </>;
}
