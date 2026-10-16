import { DISPATCH_OPTIONS } from '@/lib/dispatch';
import { tx } from '@/lib/dom-translate';
import { useCurrency } from './currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const protectedText = { translate: 'no' as const, 'data-no-translate': true };

/** 예상 발송 시간: 칸마다 누르는 버튼 대신 한 칸 드롭다운. '직접 입력'을 고르면 입력칸이 나타난다. 모든 문구는 번역 사전(tx)에 연결된다. */
export function DispatchSelect({ dispatch, customDispatch, onDispatch, onCustom }: {
  dispatch: string; customDispatch: string; onDispatch: (value: string) => void; onCustom: (value: string) => void;
}) {
  useCurrency();
  return <div {...protectedText} className="notranslate min-w-0 space-y-2">
    <Select {...(dispatch ? { value: dispatch } : {})} onValueChange={onDispatch}>
      <SelectTrigger {...protectedText} aria-label={tx('예상 발송 시간')} className="notranslate h-11 w-full min-w-0 bg-muted text-foreground"><SelectValue {...protectedText} className="notranslate" placeholder={tx('선택')} /></SelectTrigger>
      <SelectContent {...protectedText} position="popper" className="notranslate z-[200] max-h-80 max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground">
        {DISPATCH_OPTIONS.map(option => <SelectItem {...protectedText} data-i18n-skip className="notranslate" key={option.value} value={option.value}><span translate="no" data-no-translate="" className="notranslate">{tx(option.label)}</span></SelectItem>)}
        <SelectItem {...protectedText} data-i18n-skip className="notranslate text-primary" value="custom"><span translate="no" data-no-translate="" className="notranslate">{tx('직접 입력')}</span></SelectItem>
      </SelectContent>
    </Select>
    {dispatch === 'custom' && <input {...protectedText} aria-label={tx('예상 발송 시간 직접 입력')} className="notranslate form-input" maxLength={40} placeholder={tx('직접 입력 (예: 주문 후 10일 이내)')} value={customDispatch} onChange={event => onCustom(event.target.value)} />}
  </div>;
}
