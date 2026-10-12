import { useRef, useState } from 'react';
import { ALL_WATCH_BRANDS, TOP_WATCH_BRANDS, knownWatchBrand } from '@/lib/watch-brands';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import { Tx } from './tx';
import { tx } from '@/lib/dom-translate';

const noTranslate = { translate: 'no' as const, 'data-no-translate': true };

// A field in direct-input mode stays there (even with empty text, or a typed name that matches
// a listed brand) until the seller picks a listed brand; the list always re-opens on click.
const typedFields = new Set<string>();

export function BrandSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [custom, setCustom] = useState(() => Boolean(value) && (typedFields.has(id) || !knownWatchBrand(value)));
  const [open, setOpen] = useState(false);
  const known = knownWatchBrand(value);
  const customMode = custom;
  const section = known && TOP_WATCH_BRANDS.some(brand => brand === known) ? 'top' : 'all';
  const selected = customMode ? 'custom' : known ? `${section}:${known}` : '';

  return <div {...noTranslate} className="notranslate min-w-0 space-y-2">
    <Select open={open} onOpenChange={setOpen} value={selected} onValueChange={next => {
      if (next === 'custom') { setCustom(true); typedFields.add(id); setOpen(false); onChange(known ? '' : value); }
      else { setCustom(false); typedFields.delete(id); setOpen(false); onChange(next.slice(next.indexOf(':') + 1)); }
    }}>
      <SelectTrigger {...noTranslate} id={id} aria-label={tx('브랜드 선택')} className="notranslate h-11 bg-muted text-foreground">
        <SelectValue {...noTranslate} className="notranslate" placeholder={tx('브랜드 선택')} />
      </SelectTrigger>
      <SelectContent {...noTranslate} position="popper" className="notranslate z-[200] max-h-80 border-primary/30 bg-popover text-popover-foreground" onCloseAutoFocus={event => {
        if (input.current) { event.preventDefault(); input.current.focus(); }
      }}>
        <SelectItem {...noTranslate} value="custom" className="notranslate py-3 text-primary"><Tx>Custom Input (직접 입력)</Tx></SelectItem>
        <SelectGroup {...noTranslate} className="notranslate">
          <SelectLabel {...noTranslate} className="notranslate text-xs text-primary"><Tx>TOP BRANDS</Tx></SelectLabel>
          {TOP_WATCH_BRANDS.map(brand => <SelectItem {...noTranslate} data-i18n-skip key={brand} value={`top:${brand}`} className="notranslate py-2.5"><span {...noTranslate} className="notranslate">{brand}</span></SelectItem>)}
        </SelectGroup>
        <SelectSeparator {...noTranslate} className="notranslate my-2 bg-border" />
        <SelectGroup {...noTranslate} className="notranslate">
          <SelectLabel {...noTranslate} className="notranslate text-xs text-primary"><Tx>ALL BRANDS</Tx></SelectLabel>
          {ALL_WATCH_BRANDS.map(brand => <SelectItem {...noTranslate} data-i18n-skip key={brand} value={`all:${brand}`} className="notranslate py-2.5"><span {...noTranslate} className="notranslate">{brand}</span></SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
    {customMode && <input {...noTranslate} ref={input} id={`${id}-custom`} aria-label="브랜드 직접 입력" className="notranslate form-input" placeholder="브랜드 이름 직접 입력" maxLength={80} value={value} onChange={event => {
      const next = event.target.value;
      typedFields.add(id);
      onChange(next);
    }} />}
  </div>;
}
