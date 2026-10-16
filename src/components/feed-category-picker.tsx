import {useEffect,useMemo,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {motion,useReducedMotion} from 'motion/react';
import {Check,ChevronDown,Search,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {brandEnglishName,brandIds,brandMenu,categoryLabel,primaryCategories,productCategoryItems,viewCategoryIds} from '@/lib/feed-categories';
import {Select,SelectContent,SelectGroup,SelectItem,SelectLabel,SelectSeparator,SelectTrigger,SelectValue} from '@/components/ui/select';
import {tx} from '@/lib/dom-translate';
import {Tx} from './tx';

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

/** "ROLEX (롤렉스)" for brands that also have a Korean name, otherwise just the brand name. */
const brandText=(id:string,label:string)=>{const en=brandEnglishName(id);return en&&en!==label?`${en} (${label})`:label;};
const allBrands:Item[]=[...brandMenu.popular,...brandMenu.accessories,...brandMenu.others];

function PickerBody({selected,onClose,onSelect}:{selected:string;onClose:()=>void;onSelect:(id:string)=>void}){
 const [query,setQuery]=useState('');
 const q=query.trim().toLowerCase();
 const found=useMemo<Item[]>(()=>{
  if(!q)return [];
  const all:Item[]=[...viewItems,...productCategoryItems,...allBrands];
  const seen=new Set<string>();
  return all.filter(([id,label])=>!seen.has(id)&&(seen.add(id),label.toLowerCase().includes(q)||tx(label).toLowerCase().includes(q)||(brandEnglishName(id) ?? '').toLowerCase().includes(q)||id.includes(q)));
 },[q]);
 const brandItem=(id:string,label:string)=><SelectItem key={id} value={id} translate="no" data-no-translate className="notranslate py-2.5"><span translate="no" data-no-translate className="notranslate">{brandText(id,label)}</span></SelectItem>;
 return <>
  <div className="sticky top-0 z-10 -mx-5 -mt-4 border-b border-border bg-background px-5 pb-3 pt-4">
   <div className="vela-category-sheet-header"><Dialog.Title><Tx>전체 카테고리</Tx></Dialog.Title><Button variant="ghost" size="icon" aria-label="Close categories" onClick={onClose}><X/></Button></div>
   <label className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm focus-within:border-primary"><Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true"/><input type="search" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" placeholder={tx('카테고리·브랜드 검색')} aria-label={tx('카테고리·브랜드 검색')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
  </div>
  {q?<section className="pt-4" aria-live="polite">
    {found.length?<div className="flex flex-wrap gap-2">{found.map(([id,label])=><Button key={id} variant="ghost" translate="no" className={chipClass(selected===id)} aria-pressed={selected===id} onClick={()=>onSelect(id)}>{brandIds.has(id)?brandText(id,label):<Tx>{label}</Tx>}{selected===id&&<Check size={12}/>}</Button>)}</div>
     :<p className="py-6 text-center text-sm text-muted-foreground"><Tx>검색 결과가 없습니다.</Tx></p>}
  </section>:<>
  <section className="pt-4"><h2 className="mb-2 text-xs font-semibold text-muted-foreground"><Tx>보기</Tx></h2>
   <div className="flex flex-wrap gap-2">{viewItems.map(([id,label])=><Button key={id} variant="ghost" translate="no" className={chipClass(selected===id)} aria-pressed={selected===id} onClick={()=>onSelect(id)}><Tx>{label}</Tx>{selected===id&&<Check size={12}/>}</Button>)}</div></section>
  <section className="mt-5 border-t border-border pt-4"><h2 className="mb-2 text-xs font-semibold text-muted-foreground"><Tx>상품 카테고리</Tx></h2>
   <div className="flex flex-wrap gap-2">{productCategoryItems.map(([id,label])=><Button key={id} variant="ghost" translate="no" className={chipClass(selected===id)} aria-pressed={selected===id} onClick={()=>onSelect(id)}><Tx>{label}</Tx>{selected===id&&<Check size={12}/>}</Button>)}</div></section>
  <section className="mt-5 border-t border-border pt-4"><h2 className="mb-2 text-xs font-semibold text-muted-foreground"><Tx>브랜드</Tx></h2>
   <Select value={brandIds.has(selected)?selected:''} onValueChange={next=>onSelect(next)}>
    <SelectTrigger id="feed-brand-select" translate="no" data-no-translate aria-label={tx('브랜드 선택')} className="notranslate h-11 w-full bg-muted text-foreground"><SelectValue translate="no" data-no-translate className="notranslate" placeholder={tx('브랜드 선택')}/></SelectTrigger>
    <SelectContent translate="no" data-no-translate position="popper" className="notranslate z-[200] max-h-80 max-w-[calc(100vw-2rem)] border-primary/30 bg-popover text-popover-foreground">
     <SelectGroup><SelectLabel className="text-xs text-primary"><Tx>인기 브랜드</Tx></SelectLabel>{brandMenu.popular.map(([id,label])=>brandItem(id,label))}</SelectGroup>
     <SelectSeparator className="my-2 bg-border"/>
     <SelectGroup><SelectLabel className="text-xs text-primary"><Tx>명품 악세사리 브랜드</Tx></SelectLabel>{brandMenu.accessories.map(([id,label])=>brandItem(id,label))}</SelectGroup>
     <SelectSeparator className="my-2 bg-border"/>
     <SelectGroup><SelectLabel className="text-xs text-primary"><Tx>전체 브랜드</Tx></SelectLabel>{brandMenu.others.map(([id,label])=>brandItem(id,label))}</SelectGroup>
    </SelectContent>
   </Select>
  </section></>}
  {selected!=='recommend'&&<div className="mt-5 flex justify-end border-t border-border pt-3"><Button variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={()=>onSelect('recommend')}><Tx>필터 초기화</Tx></Button></div>}
 </>;
}
