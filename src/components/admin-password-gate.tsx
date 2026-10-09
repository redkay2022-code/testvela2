import { useCallback, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useServerFn } from '@tanstack/react-start';
import { ShieldAlert, X } from 'lucide-react';
import { Button } from './ui/button';
import { verifyAdminPassword } from '@/lib/seller-accounts.functions';

/**
 * Asks the signed-in admin for their password again before a destructive action.
 *   const { ask, dialog } = useAdminPasswordGate();
 *   if (!(await ask('이 카테고리를 삭제합니다.'))) return;   // proceeds only with the right password
 *   ... return <>{dialog} ...</>
 * `ask` resolves with the verified password (so a server function can check it again) or null if cancelled.
 */
export function useAdminPasswordGate() {
  const verify = useServerFn(verifyAdminPassword);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const finish = useCallback((value: string | null) => {
    resolver.current?.(value); resolver.current = null;
    setMessage(null); setPassword(''); setError(''); setPending(false);
  }, []);

  const ask = useCallback((text: string) => new Promise<string | null>(resolve => {
    resolver.current?.(null);
    resolver.current = resolve; setPassword(''); setError(''); setMessage(text);
  }), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || pending) return;
    setPending(true); setError('');
    try { await verify({ data: { password } }); finish(password); }
    catch (err) { setError(err instanceof Error && err.message ? err.message : '비밀번호를 확인하지 못했습니다.'); setPending(false); }
  };

  const dialog = <Dialog.Root open={message !== null} onOpenChange={open => { if (!open) finish(null); }}>
    <Dialog.Portal><Dialog.Overlay className="drawer-backdrop auth-backdrop"/>
      <Dialog.Content className="auth-dialog" aria-describedby={undefined} lang="ko" data-no-translate>
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center"><Dialog.Title className="flex items-center gap-2 text-lg font-bold"><ShieldAlert className="text-destructive" size={20}/>비밀번호 확인</Dialog.Title><Button variant="ghost" size="icon" type="button" aria-label="닫기" onClick={() => finish(null)}><X/></Button></div>
        <form onSubmit={submit}>
          <p className="text-sm leading-6">{message}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">삭제·초기화는 되돌릴 수 없습니다. 계속하려면 관리자 비밀번호를 한 번 더 입력하세요.</p>
          <label className="form-label mt-4" htmlFor="admin-confirm-password">관리자 비밀번호</label>
          <input id="admin-confirm-password" className="form-input" type="password" autoComplete="current-password" autoFocus required maxLength={72} value={password} onChange={e => setPassword(e.target.value)}/>
          {error && <p role="alert" className="mt-3 text-xs leading-5 text-destructive">{error}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2"><Button type="button" variant="ghost" onClick={() => finish(null)}>취소</Button><Button type="submit" variant="destructive" disabled={pending || !password}>{pending ? '확인 중…' : '확인하고 진행'}</Button></div>
        </form>
      </Dialog.Content></Dialog.Portal></Dialog.Root>;
  return { ask, dialog };
}
