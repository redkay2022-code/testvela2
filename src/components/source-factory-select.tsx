import { tx } from '@/lib/dom-translate';
import { useCurrency } from './currency';
import { factoryOptions, type SourceType } from './source-factory';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const protectedText = { translate: 'no' as const, 'data-no-translate': true };
const FACTORY_PREFIX = 'factory:';

/** 제조 / 출처 구분: 한 칸 드롭다운. 1) 커스텀 제작 2) 기타 - 직접입력 3) 공장 목록 전체. 방수 칸 오른쪽에 놓이는 칸이다. */
export function SourceFactorySelect({ id, sourceType, factory, onChange }: {
  id: string; sourceType: SourceType; factory: string; onChange: (type: SourceType, factory: string) => void;
}) {
  useCurrency();
  const current = sourceType === 'custom' ? 'custom' : sourceType === 'other' ? 'other' : factory ? `${FACTORY_PREFIX}${factory}` : undefined;
  return <div {...protectedText} className="notranslate min-w-0">
    <label {...protectedText} htmlFor={id} className="notranslate mb-2 block text-sm text-muted-foreground">{tx('제조 / 출처 구분 (Source & Factory)')}</label>
    <div {...protectedText} className="notranslate min-w-0 space-y-2">
      <Select value={current} onValueChange={next => {
        if (next === 'custom') onChange('custom', '');
        else if (next === 'other') onChange('other', sourceType === 'other' ? factory : '');
        else if (next.startsWith(FACTORY_PREFIX)) onChange('factory', next.slice(FACTORY_PREFIX.length));
      }}>
        <SelectTrigger {...protectedText} id={id} aria-label={tx('제조 / 출처 구분 (Source & Factory)')} className="notranslate h-11 w-full min-w-0 bg-muted text-foreground"><SelectValue {...protectedText} className="notranslate" placeholder={tx('공장을 선택해 주세요')} /></SelectTrigger>
        <SelectContent {...protectedText} position="popper" className="notranslate z-[200] max-h-80 max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground">
          <SelectItem {...protectedText} data-i18n-skip className="notranslate" value="custom"><span translate="no" data-no-translate="" className="notranslate">{tx('커스텀 제작')}</span></SelectItem>
          <SelectItem {...protectedText} data-i18n-skip className="notranslate" value="other"><span translate="no" data-no-translate="" className="notranslate">{tx('기타 - 직접입력')}</span></SelectItem>
          {factoryOptions.map(option => <SelectItem {...protectedText} data-i18n-skip className="notranslate" key={option} value={`${FACTORY_PREFIX}${option}`}><span translate="no" data-no-translate="" className="notranslate">{option}</span></SelectItem>)}
        </SelectContent>
      </Select>
      {sourceType === 'other' && <input {...protectedText} aria-label={tx('출처 직접 입력')} className="notranslate form-input" placeholder={tx('출처 / 공장을 직접 입력해 주세요')} maxLength={80} value={factory} onChange={event => onChange('other', event.target.value)} />}
    </div>
  </div>;
}
