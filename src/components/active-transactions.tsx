import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { ShieldAlert, Trash2, X } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { getActiveTransactions } from '@/lib/order-verification.functions';
import { verificationStatus } from '@/lib/order-verification';
import { formatMoney } from '@/lib/currency';
import { Button } from './ui/button';
import { Tx } from './tx';
import { PasswordInput } from './password-input';
import { adminDeleteOrder } from '@/lib/admin-members.functions';

/** Admin only: permanently deletes one transaction after re-entering the admin password. */
function DeleteTransaction({ order }: { order: { id: string; order_no: string; title: string } }) {
  const qc = useQueryClient(), remove = useServerFn(adminDeleteOrder);
  const [open, setOpen] = useState(false), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const close = (o: boolean) => { setOpen(o); if (!o) { setPassword(''); setError(''); } };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await remove({ data: { orderId: order.id, password } }); close(false); await qc.invalidateQueries({ queryKey: ['active-transactions'] }); }
    catch (err) { setError(err instanceof Error && err.message ? err.message : '삭제하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <Dialog.Root open={open} onOpenChange={close}>
    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}><Trash2/>삭제</Button>
    <Dialog.Portal><Dialog.Overlay className="drawer-backdrop auth-backdrop"/>
      <Dialog.Content className="auth-dialog" aria-describedby={undefined} lang="ko" data-no-translate>
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center"><Dialog.Title className="flex items-center gap-2 text-lg font-bold"><ShieldAlert className="text-destructive" size={20}/>거래 삭제</Dialog.Title><Dialog.Close asChild><Button type="button" variant="ghost" size="icon" aria-label="닫기"><X/></Button></Dialog.Close></div>
        <form onSubmit={submit}>
          <p className="text-sm break-all"><strong>{order.title}</strong> <span className="text-muted-foreground">({order.order_no})</span></p>
          <p className="mt-3 text-xs leading-5 text-destructive">⚠ 이 거래와 관련된 결제 검증 기록·메시지·QC 사진·교환 기록이 영구 삭제되며 되돌릴 수 없습니다. 실제 고객의 거래라면 삭제하지 마세요.</p>
          <label className="form-label mt-4" htmlFor="delete-order-password">관리자 비밀번호</label>
          <PasswordInput id="delete-order-password" label="비밀번호 보기" autoComplete="current-password" required maxLength={72} value={password} onChange={e => setPassword(e.target.value)}/>
          {error && <p role="alert" className="mt-3 text-xs leading-5 text-destructive">{error}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2"><Button type="button" variant="ghost" onClick={() => close(false)}>취소</Button><Button type="submit" variant="destructive" disabled={busy || !password}>{busy ? '삭제 중…' : '영구 삭제'}</Button></div>
        </form>
      </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function ActiveTransactions({ role, userId }: { role: 'buyer' | 'seller' | 'admin'; userId: string }) {
  const read = useServerFn(getActiveTransactions);
  const query = useQuery({ queryKey: ['active-transactions', role, userId], queryFn: () => read({ data: { role } }), refetchInterval: 5000 });
  const render = (o: { id: string; order_no: string; title: string; post_id: string | null; buyer_id: string; buyer_name: string; seller_id: string | null; seller_name: string; amount_usd: number; network: string | null; payment_verified_at: string | null; buyer_code?: string; seller_code?: string | null }) => <article key={o.id} className="border-b border-border py-4 min-w-0">
    <p className="text-xs text-muted-foreground break-all">{o.order_no}</p><h3 className="my-1 font-semibold break-words">{o.title}</h3>
    <p className="text-xs text-muted-foreground break-all"><Tx>상품</Tx> · {o.post_id ?? '—'}</p>
    {role !== 'buyer' && <p className="mt-2 text-sm break-words"><Tx>구매자</Tx> · {o.buyer_name}<small className="block text-muted-foreground break-all">{o.buyer_code ?? o.buyer_id}</small></p>}
    {role !== 'seller' && <p className="mt-2 text-sm break-words"><Tx>판매자</Tx> · {o.seller_name}<small className="block text-muted-foreground break-all">{o.seller_code ?? o.seller_id ?? '—'}</small></p>}
    <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><strong className="text-primary">{formatMoney(Number(o.amount_usd), 'USD')} {o.network}</strong><span className="text-primary">{verificationStatus(o) === 'CONFIRMED' ? <Tx>입금 확인됨 · 에스크로 보관</Tx> : <Tx>TXID 검증 대기</Tx>}</span></div>
    <small className="text-muted-foreground">{verificationStatus(o)}</small>
    {role === 'admin' && <div className="mt-3"><DeleteTransaction order={o}/></div>}
  </article>;
  return <section className="my-6 notranslate" translate="no" data-no-translate aria-label="진행 중인 거래"><div className="section-heading"><h2><Tx>진행 중인 거래</Tx></h2><span><Tx values={{ 0: query.data?.length ?? 0 }}>{'{0}건'}</Tx></span></div>
    {query.isPending ? <p><Tx>주문을 불러오는 중…</Tx></p> : query.isError ? <div role="alert"><p><Tx>진행 중인 거래를 불러오지 못했습니다.</Tx></p><Button variant="ghost" onClick={() => void query.refetch()}><Tx>다시 시도</Tx></Button></div> : query.data?.length ? query.data.map(o => render(o)) : <p className="text-sm text-muted-foreground"><Tx>No active transactions.</Tx></p>}
  </section>;
}