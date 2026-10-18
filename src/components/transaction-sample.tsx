import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
const key = 'vela-sample-txid-confirmed-v1';
const Context = createContext({ confirmed: false, confirm: () => {}, reset: () => {} });
export function TransactionSampleProvider({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    try { setConfirmed(localStorage.getItem(key) === '1'); } catch { /* local preview remains usable */ }
    const sync = (e: StorageEvent) => { if (e.key === key) { setConfirmed(e.newValue === '1'); if (e.newValue === '1') toast.success('샘플 TXID 검증 완료 · VM-35FAFF34'); } };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  const change = (value: boolean) => { setConfirmed(value); try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* state stays in this preview */ } };
  return <Context.Provider value={{ confirmed, confirm: () => { change(true); toast.success('샘플 TXID 검증 완료 · VM-35FAFF34', { description: '실제 입금·매출·포인트는 변경되지 않습니다.' }); }, reset: () => change(false) }}>{children}</Context.Provider>;
}
export const useTransactionSample = () => useContext(Context);