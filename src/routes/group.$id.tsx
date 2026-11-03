import { useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown, usePublicGroup } from '@/components/group-purchase';
import { isGroupId, rememberGroup } from '@/lib/group';
import { tx } from '@/lib/dom-translate';

/** 공동구매 링크: /group/<그룹 ID> — 방문 기록(30일)을 남기고 참여 화면을 보여준다. */
export const Route = createFileRoute('/group/$id')({
  head: () => ({ meta: [{ title: 'VELA Group Purchase' }, { name: 'description', content: 'Buy together with friends on VELA and earn bonus points.' }] }),
  component: GroupPage,
});

function GroupPage() {
  const { id } = Route.useParams();
  useEffect(() => { rememberGroup(id); }, [id]);
  const q = usePublicGroup(isGroupId(id) ? id : null);
  const g = q.data;
  const open = Boolean(g && g.status === 'active' && new Date(g.expires_at).getTime() > Date.now());
  return <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
    <h1 className="flex items-center gap-2 text-xl font-semibold"><Users size={20} className="text-primary" />{tx('공동구매')}</h1>
    {q.isLoading ? <p className="mt-6 text-sm text-muted-foreground">{tx('불러오는 중…')}</p>
      : !g ? <div className="lux-empty mt-6"><p>{tx('공동구매를 찾을 수 없어요.')}</p><Button asChild variant="goldOutline" className="mt-4"><Link to="/">{tx('홈으로')}</Link></Button></div>
      : <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="flex gap-3">{g.image && <img src={g.image} alt="" width={72} height={72} className="size-[72px] rounded-md object-cover" loading="lazy" />}
          <div className="min-w-0"><p className="truncate font-semibold" data-no-translate>{g.title}</p><p className="mt-1 text-xs text-muted-foreground">{tx('리더')}: <span data-no-translate>{g.leader}</span></p></div></div>
        <p className="mt-4 text-2xl font-bold text-primary" data-no-translate>{g.current_size}/{g.target_size}</p>
        <p className="mt-1 text-sm">{open ? <Countdown expiresAt={g.expires_at} /> : tx('이 공동구매는 마감됐어요.')}</p>
        <p className="mt-3 text-xs text-muted-foreground">{tx('{n}명이 모이면 참여자 {p}% · 리더 +{l}% 포인트', { n: g.target_size, p: g.participant_pct, l: g.leader_pct })}{g.welcome ? ` · ${tx('웰컴 보너스 포인트')}` : ''}</p>
        <p className="mt-1 text-xs text-muted-foreground">{tx('모든 참여자가 수령 확정을 하면 포인트가 지급돼요. 취소·환불·분쟁 주문은 제외돼요.')}</p>
        <Button asChild variant="gold" className="mt-5 w-full"><Link to="/buy/$id" params={{ id: g.product_id }}>{open ? tx('함께 구매하기') : tx('상품 보러가기')}</Link></Button>
      </section>}
  </main>;
}
