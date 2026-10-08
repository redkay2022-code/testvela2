import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Check, MessageCircle, ShieldCheck, Star, Store } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { marketSearch, pageHead, postsQuery } from '@/lib/market';
import { luxuryPosts } from '@/lib/luxury-market';
import { sellerIdentity } from '@/lib/seller-directory';
import { usePostRatings, useSellerRatingMap, withLiveRatings } from '@/lib/studio-tier';
import { formatDate } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { CheckoutForm } from '@/components/luxury-marketplace';
import { SellerBadge } from '@/components/reputation';
import { ProductComments } from '@/components/product-comments';
import { EscrowGuarantee } from '@/components/escrow';

export const Route = createFileRoute('/buy/$id')({
  validateSearch: marketSearch,
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  head: () => pageHead('Buy on VELA · Secure Crypto Escrow', 'Review buyer ratings, ask the studio a question and pay securely with crypto escrow on VELA.'),
  errorComponent: () => <div className="lux-empty">구매 페이지를 불러오지 못했습니다. 다시 시도해 주세요.</div>,
  notFoundComponent: () => <div className="lux-empty">상품을 찾을 수 없습니다.</div>,
  component: BuyPage,
});

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return <span className="inline-flex text-primary" aria-label={`${value.toFixed(1)} / 5`}>{[1, 2, 3, 4, 5].map(n => <Star key={n} size={size} fill={n <= Math.round(value) ? 'currentColor' : 'none'} />)}</span>;
}

function BuyPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(postsQuery);
  const ratingMap = useSellerRatingMap();
  const post = withLiveRatings(luxuryPosts(data), ratingMap.data).find(p => p.id === id);
  const postRatings = usePostRatings();
  const [user, setUser] = useState<User | null>(null), [done, setDone] = useState(false), [ask, setAsk] = useState(false);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setUser(data.user)); const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null)); return () => subscription.unsubscribe(); }, []);
  const reviews = useQuery({ queryKey: ['post-reviews', id], queryFn: async () => (await supabase.from('reviews').select('id, nickname, rating, body, created_at').eq('post_id', id).order('created_at', { ascending: false }).limit(20)).data ?? [] });
  const requestAuth = () => void navigate({ to: '/', search: { auth: true } });
  if (!post) return <div className="lux-empty"><h2>상품을 찾을 수 없습니다.</h2><Button asChild variant="goldOutline"><Link to="/">홈으로</Link></Button></div>;
  const pr = postRatings.data?.[post.id];
  return <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-4">
    <Button variant="ghost" size="sm" onClick={() => window.history.length > 1 ? window.history.back() : void navigate({ to: '/' })}><ArrowLeft size={16} />돌아가기</Button>
    <h1 className="mt-3 text-xl font-semibold">구매하기</h1>
    <section className="mt-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2" data-no-translate><span className="flex items-center gap-2 font-semibold"><Store size={16} className="text-primary" />{post.creator}<SellerBadge reputation={post.reputation} withRating /></span><Button asChild variant="goldOutline" size="sm"><Link to="/store" search={{ seller: sellerIdentity(post), storeTab: 'reviews' }}>셀러 리뷰</Link></Button></div>
      <div className="mt-3 flex items-center gap-2 text-sm">{pr ? <><Stars value={pr.average} /><strong>{pr.average.toFixed(1)}</strong><span className="text-muted-foreground">이 상품 구매자 평점 · {pr.count}개</span></> : <span className="text-muted-foreground">이 상품의 구매자 평점이 아직 없습니다.</span>}</div>
      <div className="mt-4 flex gap-2"><Button variant="goldOutline" className="flex-1" aria-pressed={ask} onClick={() => setAsk(v => !v)}><MessageCircle size={16} />판매자에게 문의</Button></div>
      {ask && <div className="mt-3"><p className="text-xs text-muted-foreground">문의는 상품 Q&A에 올라가며 판매자가 답변합니다. 결제 후에는 주문 내역에서 판매자와 1:1 채팅을 할 수 있습니다.</p><ProductComments postId={post.id} user={user} requestAuth={requestAuth} qna /></div>}
    </section>
    <section className="mt-4 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-primary" />에스크로 결제</h2>
      {done ? <div className="py-6 text-center"><Check className="mx-auto mb-3 text-primary" size={32} /><p className="font-semibold">주문이 접수되었습니다.</p><p className="mt-2 text-sm text-muted-foreground">관리자가 TXID 입금을 확인하면 판매자가 준비를 시작합니다.</p><Button asChild variant="goldOutline" className="mt-5"><Link to="/me" search={{ panel: 'orders' }}>주문 내역 · 판매자 채팅</Link></Button></div>
        : post.outOfStock ? <p className="mt-3 text-sm font-semibold text-destructive">품절 · 재입고 후 구매할 수 있습니다.</p>
        : post.price === null ? <p className="mt-3 text-sm text-muted-foreground">판매 가격이 없는 게시물입니다. 판매자에게 문의해 주세요.</p>
        : !user ? <div className="mt-3"><p className="text-sm text-muted-foreground">결제하려면 로그인이 필요합니다.</p><Button variant="gold" className="mt-3 w-full" onClick={requestAuth}>로그인하고 결제하기</Button></div>
        : <CheckoutForm item={post} onDone={() => setDone(true)} />}
    </section>
    <EscrowGuarantee />
    <section className="mt-6">
      <h2 className="text-sm font-semibold">구매자 리뷰</h2>
      {reviews.data?.length ? <div className="mt-3 grid gap-3">{reviews.data.map(r => <article key={r.id} className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1 font-semibold" data-no-translate>{r.nickname}<BadgeCheck size={14} className="text-primary" aria-label="인증 구매자" /></span><span className="text-muted-foreground">{formatDate(r.created_at)}</span></div>{r.rating !== null && <div className="mt-2"><Stars value={r.rating} size={12} /></div>}<p className="mt-2 text-sm leading-6 text-muted-foreground">{r.body}</p></article>)}</div>
        : <p className="mt-2 text-sm text-muted-foreground">아직 이 상품의 리뷰가 없습니다. 구매 후 수령 확인을 하면 별점과 리뷰를 남길 수 있습니다.</p>}
    </section>
  </main>;
}
