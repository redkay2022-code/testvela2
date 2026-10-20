import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getActiveTransactions } from '@/lib/order-verification.functions';
import { sampleTransaction, verificationStatus } from '@/lib/order-verification';
import { formatMoney } from '@/lib/currency';
import { useTransactionSample } from './transaction-sample';
import { Button } from './ui/button';
import { Tx } from './tx';

export function ActiveTransactions({ role, userId }: { role: 'buyer' | 'seller' | 'admin'; userId: string }) {
  const read = useServerFn(getActiveTransactions), sample = useTransactionSample();
  const query = useQuery({ queryKey: ['active-transactions', role, userId], queryFn: () => read({ data: { role } }), refetchInterval: 5000 });
  const render = (o: { id: string; order_no: string; title: string; post_id: string | null; buyer_id: string; buyer_name: string; seller_id: string | null; seller_name: string; amount_usd: number; network: string | null; payment_verified_at: string | null; buyer_code?: string; seller_code?: string | null }, demo = false) => <article key={o.id} className="border-b border-border py-4 min-w-0">
    <p className="text-xs text-muted-foreground break-all">{o.order_no}{demo && ' · SAMPLE'}</p><h3 className="my-1 font-semibold break-words">{o.title}</h3>
    <p className="text-xs text-muted-foreground break-all"><Tx>상품</Tx> · {o.post_id ?? '—'}</p>
    {role !== 'buyer' && <p className="mt-2 text-sm break-words"><Tx>구매자</Tx> · {o.buyer_name}<small className="block text-muted-foreground break-all">{o.buyer_code ?? o.buyer_id}</small></p>}
    {role !== 'seller' && <p className="mt-2 text-sm break-words"><Tx>판매자</Tx> · {o.seller_name}<small className="block text-muted-foreground break-all">{o.seller_code ?? o.seller_id ?? '—'}</small></p>}
    <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><strong className="text-primary">{formatMoney(Number(o.amount_usd), 'USD')} {o.network}</strong><span className="text-primary">{verificationStatus(o) === 'CONFIRMED' ? <Tx>입금 확인됨 · 에스크로 보관</Tx> : <Tx>TXID 검증 대기</Tx>}</span></div>
    <small className="text-muted-foreground">{verificationStatus(o)}</small>
    {demo && role === 'admin' && <div className="mt-3"><Button size="sm" variant="goldOutline" disabled={sample.confirmed} onClick={sample.confirm}><Tx>샘플 입금 확인됨</Tx></Button>{sample.confirmed && <Button size="sm" variant="ghost" onClick={sample.reset}><Tx>샘플 초기화</Tx></Button>}</div>}
  </article>;
  return <section className="my-6 notranslate" translate="no" data-no-translate aria-label="진행 중인 거래"><div className="section-heading"><h2><Tx>진행 중인 거래</Tx></h2><span><Tx values={{ 0: query.data?.length ?? 0 }}>{'{0}건'}</Tx></span></div>
    {query.isPending ? <p><Tx>주문을 불러오는 중…</Tx></p> : query.isError ? <div role="alert"><p><Tx>진행 중인 거래를 불러오지 못했습니다.</Tx></p><Button variant="ghost" onClick={() => void query.refetch()}><Tx>다시 시도</Tx></Button></div> : query.data?.length ? query.data.map(o => render(o)) : <p className="text-sm text-muted-foreground"><Tx>진행 중인 거래가 없습니다.</Tx></p>}
    {role === 'admin' && <details className="mt-4 border-t border-border pt-3" open><summary className="cursor-pointer text-xs text-muted-foreground"><Tx>샘플 거래 · 실제 주문과 별도</Tx></summary>{render({ ...sampleTransaction, payment_verified_at: sample.confirmed ? 'sample-confirmed' : null }, true)}</details>}
  </section>;
}