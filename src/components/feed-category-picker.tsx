import {useEffect,useMemo,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {motion,useReducedMotion} from 'motion/react';
import {ChevronDown,Search,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {brandDisplayName,brandEnglishName,brandIds,brandMenu,brandsByCategory,categoryLabel,sortBrandChoices,primaryCategories,productCategoryItems,splitFeedId,viewCategoryIds,type FeedPostLike} from '@/lib/feed-categories';
import {Select,SelectContent,SelectGroup,SelectItem,SelectLabel,SelectSeparator,SelectTrigger,SelectValue} from '@/components/ui/select';
import {tx} from '@/lib/dom-translate';
import {useCurrency} from './currency';
import {Tx} from './tx';
import {watchStoryOptions} from '@/lib/watch-story';
import {t} from '@/lib/i18n';

type Item=readonly [string,string];
const viewItems:readonly Item[]=primaryCategories.filter(item=>viewCategoryIds.includes(item[0]));
const chipBase='notranslate inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs leading-none transition-colors';
const chipClass=(on:boolean)=>`${chipBase} ${on?'border-primary bg-accent font-semibold text-primary':'border-border bg-card text-foreground hover:border-primary/60'}`;

export function FeedCategoryPicker({catalog,selected='recommend',open,onOpen,onClose,onSelect}:{catalog:readonly FeedPostLike[];selected?:string|undefined;open:boolean;onOpen:()=>void;onClose:()=>void;onSelect:(id:string,keepOpen?:boolean)=>void}){
 const reduced=useReducedMotion(),bar=useRef<HTMLDivElement>(null),{lang}=useCurrency();
 const chips:readonly Item[]=primaryCategories.some(item=>item[0]===selected)?primaryCategories:[...primaryCategories,[selected,categoryLabel(selected)]];
 useEffect(()=>{bar.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced?'auto':'smooth'});},[selected,reduced]);
 return <><div className="vela-category-row"><nav className="red-home-subtabs notranslate" translate="no" aria-label="Home categories" ref={bar}>{chips.map(([id,label])=><Button key={id} variant="ghost" className={`red-home-subtab notranslate ${selected===id?'active':''}`} translate="no" aria-pressed={selected===id} onClick={()=>onSelect(id)}>{primaryCategories.some(item=>item[0]===id)?<Tx>{label}</Tx>:selectionLabel(id,lang)}</Button>)}</nav><Button variant="ghost" size="icon" className="vela-category-expand" aria-label="All categories" aria-expanded={open} onClick={onOpen}><ChevronDown/></Button></div>
 <Dialog.Root open={open} onOpenChange={value=>{if(!value)onClose();}}><Dialog.Portal><Dialog.Overlay className="lux-backdrop overlay-front"/><Dialog.Content asChild aria-describedby={undefined}><motion.section className="vela-category-sheet notranslate" translate="no" initial={{y:reduced?0:24,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:reduced?0:.2}}><PickerBody catalog={catalog} selected={selected} onClose={onClose} onSelect={onSelect}/></motion.section></Dialog.Content></Dialog.Portal></Dialog.Root></>;
}

/** Brand name in the site language, followed by the Latin name when they differ: "롤렉스 (ROLEX)". */
const brandText=(id:string,label:string,lang:string)=>{const name=brandDisplayName(id,lang,label),en=brandEnglishName(id);return en&&en!==name?`${name} (${en})`:name;};
/** Chip text for a selection that is not one of the main categories: a brand, or "시계 · ROLEX" (category · brand) in the site language. */
const selectionLabel=(id:string,lang:string)=>{const story=watchStoryOptions.find(option=>`story:${option[0]}`===id);if(story)return t(story[2]);const {category,brand}=splitFeedId(id);const brandName=(b:string)=>brandText(b,categoryLabel(b),lang);const cat=tx(categoryLabel(category));return brand?`${cat} · ${brandName(brand)}`:brandIds.has(id)||id.startsWith('b:')?brandName(id):tx(categoryLabel(id));};
const allBrands:Item[]=[...brandMenu.popular,...brandMenu.accessories,...brandMenu.others];

function PickerBody({catalog,selected,onClose,onSelect}:{catalog:readonly FeedPostLike[];selected:string;onClose:()=>void;onSelect:(id:string,keepOpen?:boolean)=>void}){
 const {lang}=useCurrency(),[query,setQuery]=useState(''),[tab,setTab]=useState<string>(()=>{const c=splitFeedId(selected).category;return productCategoryItems.some(i=>i[0]===c)?c:'';});
 const byCategory=useMemo(()=>brandsByCategory(catalog),[catalog]);
 /* Every brand a seller can pick when uploading, plus brands typed in by sellers for this category. */
 const tabBrands=useMemo(()=>{if(!tab)return [];const known=new Set(allBrands.map(b=>b[0])),extra=(byCategory[tab] ?? []).filter(b=>!known.has(b.id)).map(b=>({id:b.id,label:b.label}));return sortBrandChoices([...allBrands.map(([id,label])=>({id,label})),...extra],lang);},[tab,byCategory,lang]);
 const q=query.trim().toLowerCase();
 const found=useMemo<Item[]>(()=>{
  if(!q)return [];
  const all:Item[]=[...viewItems,...productCategoryItems,...allBrands];
  const seen=new Set<string>();
  return all.filter(([id,label])=>!seen.has(id)&&(seen.add(id),label.toLowerCase().includes(q)||tx(label).toLowerCase().includes(q)||(brandEnglishName(id) ?? '').toLowerCase().includes(q)||brandDisplayName(id,lang,label).toLowerCase().includes(q)||id.includes(q)));
 },[q,lang]);
 return <>
  <div className="sticky top-0 z-10 -mx-5 -mt-4 border-b border-border bg-background px-5 pb-3 pt-4">
   <div className="vela-category-sheet-header"><Dialog.Title><Tx>전체 카테고리</Tx></Dialog.Title><Button variant="ghost" size="icon" aria-label="Close categories" onClick={onClose}><X/></Button></div>
   <label className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm focus-within:border-primary"><Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true"/><input type="search" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" placeholder={tx('카테고리·브랜드 검색')} aria-label={tx('카테고리·브랜드 검색')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
  </div>
  {q?<section className="pt-4" aria-live="polite">
    {found.length?<div className="flex flex-wrap gap-2">{found.map(([id,label])=><Button key={id} variant="ghost" translate="no" className={chipClass(selected===id)} aria-pressed={selected===id} onClick={()=>onSelect(id)}>{brandIds.has(id)?brandText(id,label,lang):<Tx>{label}</Tx>}</Button>)}</div>
     :<p className="py-6 text-center text-sm text-muted-foreground"><Tx>검색 결과가 없습니다.</Tx></p>}
  </section>:<>
  <section className="pt-4"><h2 className="mb-2 text-xs font-semibold text-muted-foreground"><Tx>보기</Tx></h2>
   <div className="flex flex-wrap gap-2">{viewItems.map(([id,label])=><Button key={id} variant="ghost" translate="no" className={chipClass(selected===id)} aria-pressed={selected===id} onClick={()=>onSelect(id)}><Tx>{label}</Tx></Button>)}</div></section>
   <section className="mt-5 border-t border-border pt-4"><h2 className="mb-2 text-xs font-semibold text-muted-foreground" data-i18n-skip>{t('story')}</h2><StorySubcategoryTabs selected={selected} onSelect={onSelect}/></section>
  <section className="mt-5 border-t border-border pt-4"><h2 className="mb-2 text-xs font-semibold text-muted-foreground"><Tx>상품 카테고리</Tx></h2>
   <div className="flex flex-wrap gap-2" role="tablist" aria-label={tx('상품 카테고리')}>{productCategoryItems.map(([id,label])=>{const active=tab===id;
    return <Button key={id} variant="ghost" translate="no" role="tab" aria-selected={active} className={chipClass(active)} onClick={()=>setTab(id)}><Tx>{label}</Tx></Button>;})}</div>
   <div className="mt-4">
    <h3 className="mb-2 text-xs font-semibold text-muted-foreground"><Tx>브랜드</Tx></h3>
    {tab?<Select value={splitFeedId(selected).category===tab?selected:''} onValueChange={next=>onSelect(next)}>
     <SelectTrigger id="feed-brand-select" translate="no" data-no-translate aria-label={tx('브랜드 선택')} className="notranslate h-11 w-full bg-muted text-foreground"><SelectValue translate="no" data-no-translate className="notranslate" placeholder={tx('브랜드 선택')}/></SelectTrigger>
     <SelectContent translate="no" data-no-translate position="popper" className="notranslate z-[200] max-h-80 max-w-[calc(100vw-2rem)] border-primary/30 bg-popover text-popover-foreground">
      <SelectItem value={tab} translate="no" data-no-translate className="notranslate py-2.5 text-primary"><span translate="no" data-no-translate className="notranslate"><Tx>{categoryLabel(tab)}</Tx> <Tx>전체</Tx></span></SelectItem>
      {tabBrands.length>0&&<SelectSeparator className="my-2 bg-border"/>}
      {tabBrands.map(b=><SelectItem key={b.id} value={`${tab}~${b.id}`} translate="no" data-no-translate className="notranslate py-2.5"><span translate="no" data-no-translate className="notranslate">{brandText(b.id,b.label,lang)}</span></SelectItem>)}
     </SelectContent>
    </Select>:<p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground"><Tx>상품 카테고리를 선택하면 브랜드를 고를 수 있어요.</Tx></p>}
   </div>
  </section></>}
  {selected!=='recommend'&&<div className="mt-5 flex justify-end border-t border-border pt-3"><Button variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={()=>onSelect('recommend')}><Tx>필터 초기화</Tx></Button></div>}
 </>;
}

export function StorySubcategoryTabs({selected,onSelect}:{selected:string;onSelect:(id:string)=>void}){
 useCurrency();
 return <nav className="notranslate flex flex-wrap gap-2" translate="no" data-no-swipe role="tablist" aria-label={t('storySubcategory')}>
  <Button variant="ghost" role="tab" className={chipClass(selected==='story')} translate="no" data-i18n-skip aria-selected={selected==='story'} onClick={()=>onSelect('story')}>{tx('전체')}</Button>
  {watchStoryOptions.map(([id,,key])=><Button key={id} variant="ghost" role="tab" className={chipClass(selected===`story:${id}`)} translate="no" data-i18n-skip aria-selected={selected===`story:${id}`} onClick={()=>onSelect(`story:${id}`)}>{t(key)}</Button>)}
 </nav>;
}
