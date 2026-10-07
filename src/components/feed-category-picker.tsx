import {useEffect,useRef} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {motion,useReducedMotion} from 'motion/react';
import {Check,ChevronDown,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {categoryGroups,categoryLabel,primaryCategories} from '@/lib/feed-categories';

export function FeedCategoryPicker({selected='recommend',open,onOpen,onClose,onSelect}:{selected?:string;open:boolean;onOpen:()=>void;onClose:()=>void;onSelect:(id:string)=>void}){
 const reduced=useReducedMotion(),bar=useRef<HTMLDivElement>(null);
 const chips:readonly (readonly [string,string])[]=primaryCategories.some(item=>item[0]===selected)?primaryCategories:[...primaryCategories,[selected,categoryLabel(selected)]];
 useEffect(()=>{bar.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced?'auto':'smooth'});},[selected,reduced]);
 return <><div className="vela-category-row"><nav className="red-home-subtabs" aria-label="Home categories" ref={bar}>{chips.map(([id,label])=><Button key={id} variant="ghost" className={`red-home-subtab ${selected===id?'active':''}`} aria-pressed={selected===id} onClick={()=>onSelect(id)}>{label}</Button>)}</nav><Button variant="ghost" size="icon" className="vela-category-expand" aria-label="All categories" aria-expanded={open} onClick={onOpen}><ChevronDown/></Button></div>
 <Dialog.Root open={open} onOpenChange={value=>{if(!value)onClose();}}><Dialog.Portal><Dialog.Overlay className="lux-backdrop overlay-front"/><Dialog.Content asChild aria-describedby={undefined}><motion.section className="vela-category-sheet" initial={{y:reduced?0:24,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:reduced?0:.2}}><div className="vela-category-sheet-header"><Dialog.Title>전체 카테고리</Dialog.Title><Button variant="ghost" size="icon" aria-label="Close categories" onClick={onClose}><X/></Button></div>{categoryGroups.map(group=><section className="vela-category-group" key={group.label}><h2>{group.label}</h2><div className="vela-category-grid">{group.items.map(([id,label])=><Button key={id} variant="ghost" className={selected===id?'active':''} aria-pressed={selected===id} onClick={()=>onSelect(id)}>{label}{selected===id&&<Check size={13}/>}</Button>)}</div></section>)}</motion.section></Dialog.Content></Dialog.Portal></Dialog.Root></>;
}