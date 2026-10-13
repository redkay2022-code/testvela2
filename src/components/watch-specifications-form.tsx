import { useState } from 'react';
import { watchSpecificationFields, numericSpecValue } from '@/lib/watch-specifications';
import { BrandSelect } from './brand-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tx } from './tx';
import { tx } from '@/lib/dom-translate';

const protectedText = { translate: 'no' as const, 'data-no-translate': true };

function SpecificationSelect({ id, label, value, options, custom, onChange }: {
  id: string; label: string; value: string; options: readonly string[]; custom?: boolean; onChange: (value: string) => void;
}) {
  const [customMode, setCustomMode] = useState(Boolean(custom && value && !options.includes(value)));
  const unknown = Boolean(value && !options.includes(value));
  return <div {...protectedText} className="notranslate min-w-0 space-y-2">
    <Select value={customMode ? '__custom' : value} onValueChange={next => {
      if (next === '__custom') { setCustomMode(true); if (options.includes(value)) onChange(''); }
      else { setCustomMode(false); onChange(next); }
    }}>
      <SelectTrigger {...protectedText} id={id} aria-label={tx(label)} className="notranslate h-11 w-full min-w-0 bg-muted text-foreground"><SelectValue {...protectedText} className="notranslate" placeholder={tx('선택')} /></SelectTrigger>
      <SelectContent {...protectedText} position="popper" className="notranslate z-[200] max-h-80 max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground">
        {unknown && !customMode && <SelectItem {...protectedText} data-i18n-skip className="notranslate" value={value}>{value}</SelectItem>}
        {options.map(option => <SelectItem {...protectedText} data-i18n-skip className="notranslate" key={option} value={option}><span translate="no" data-no-translate="" className="notranslate">{option}</span></SelectItem>)}
        {custom && <SelectItem {...protectedText} data-i18n-skip className="notranslate text-primary" value="__custom"><span translate="no" data-no-translate="" className="notranslate">직접입력 (Custom Input)</span></SelectItem>}
      </SelectContent>
    </Select>
    {customMode && <input {...protectedText} id={`${id}-custom`} aria-label={`${label} 직접 입력`} className="notranslate form-input min-w-0" maxLength={80} value={value} placeholder="케이스 소재 직접 입력" onChange={event => onChange(event.target.value)} />}
  </div>;
}

export function WatchSpecificationsForm({ idPrefix, value, onChange }: {
  idPrefix: string; value: Record<string, string>; onChange: (value: Record<string, string>) => void;
}) {
  return <section {...protectedText} className="notranslate mt-5 min-w-0" aria-label="시계 사양">
    <h3 {...protectedText} className="notranslate mb-3 text-sm font-semibold text-primary"><Tx>시계 사양</Tx></h3>
    <div {...protectedText} className="notranslate grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
      {watchSpecificationFields.map(field => {
        const id = `${idPrefix}-${field.key}`;
        const current = value[field.key] ?? '';
        const update = (next: string) => onChange({ ...value, [field.key]: next });
        return <div {...protectedText} className={`notranslate min-w-0 ${field.kind === 'textarea' ? 'md:col-span-2' : ''}`} key={field.key}>
          <label {...protectedText} htmlFor={id} className="notranslate mb-2 block text-sm text-muted-foreground"><Tx>{field.label}</Tx></label>
          {field.kind === 'brand' ? <BrandSelect id={id} value={current} onChange={update} />
            : field.kind === 'select' ? <SpecificationSelect id={id} label={field.label} value={current} options={field.options} custom={'custom' in field && field.custom} onChange={update} />
            : field.kind === 'textarea' ? <textarea {...protectedText} id={id} className="notranslate form-input min-h-28 resize-y" rows={4} maxLength={3000} placeholder={field.placeholder} value={current} onChange={event => update(event.target.value)} />
            : field.kind === 'number' ? <div {...protectedText} className="notranslate flex min-w-0 items-center gap-3">
              <input {...protectedText} id={id} type="number" inputMode="decimal" min={0} step="any" className="notranslate form-input min-w-0 flex-1" placeholder={field.placeholder} value={numericSpecValue(current)} onChange={event => update(event.target.value ? `${event.target.value} ${field.key === 'powerReserve' ? 'Hours' : field.unit}` : '')} />
              <span {...protectedText} className="notranslate shrink-0 text-xs text-muted-foreground"><Tx>{field.unit}</Tx></span>
            </div>
            : <input {...protectedText} id={id} className="notranslate form-input min-w-0" maxLength={80} placeholder={field.placeholder} value={current} onChange={event => update(event.target.value)} />}
        </div>;
      })}
    </div>
  </section>;
}