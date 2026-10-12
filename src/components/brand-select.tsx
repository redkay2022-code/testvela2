import { useRef, useState } from 'react';
import { ALL_WATCH_BRANDS, TOP_WATCH_BRANDS, knownWatchBrand } from '@/lib/watch-brands';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';

const noTranslate = { translate: 'no' as const, 'data-i18n-skip': true };

export function BrandSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [custom, setCustom] = useState(false);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const known = knownWatchBrand(value);
  const customMode = custom || Boolean(value && !known);
  const section = known && TOP_WATCH_BRANDS.some(brand => brand === known) ? 'top' : 'all';
  const selected = customMode ? 'custom' : known ? `${section}:${known}` : '';

  return <div {...noTranslate} className="notranslate min-w-0 space-y-2">
    <Select open={open} onOpenChange={next => {
      if (next && customMode) { input.current?.focus(); return; }
      setOpen(next);
    }} value={selected} onValueChange={next => {
      if (next === 'custom') { setCustom(true); setOpen(false); onChange(customMode ? value : ''); }
      else { setCustom(false); setOpen(false); onChange(next.slice(next.indexOf(':') + 1)); }
    }}>
      <SelectTrigger {...noTranslate} id={id} aria-label="브랜드 선택" className="notranslate h-11 bg-muted text-foreground">
        <SelectValue {...noTranslate} className="notranslate" placeholder="브랜드 선택" />
      </SelectTrigger>
      <SelectContent {...noTranslate} position="popper" className="notranslate z-[200] max-h-80 border-primary/30 bg-popover text-popover-foreground" onCloseAutoFocus={event => {
        if (input.current) { event.preventDefault(); input.current.focus(); }
      }}>
        <SelectItem {...noTranslate} value="custom" className="notranslate py-3 text-primary"><span {...noTranslate} className="notranslate">Custom Input (직접 입력)</span></SelectItem>
        <SelectGroup {...noTranslate} className="notranslate">
          <SelectLabel {...noTranslate} className="notranslate text-xs text-primary">TOP BRANDS</SelectLabel>
          {TOP_WATCH_BRANDS.map(brand => <SelectItem {...noTranslate} key={brand} value={`top:${brand}`} className="notranslate py-2.5"><span {...noTranslate} className="notranslate">{brand}</span></SelectItem>)}
        </SelectGroup>
        <SelectSeparator {...noTranslate} className="notranslate my-2 bg-border" />
        <SelectGroup {...noTranslate} className="notranslate">
          <SelectLabel {...noTranslate} className="notranslate text-xs text-primary">ALL BRANDS</SelectLabel>
          {ALL_WATCH_BRANDS.map(brand => <SelectItem {...noTranslate} key={brand} value={`all:${brand}`} className="notranslate py-2.5"><span {...noTranslate} className="notranslate">{brand}</span></SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
    {customMode && <input {...noTranslate} ref={input} id={`${id}-custom`} aria-label="브랜드 직접 입력" className="notranslate form-input" placeholder="브랜드 이름 직접 입력" maxLength={80} value={value} onChange={event => onChange(event.target.value)} />}
  </div>;
}
