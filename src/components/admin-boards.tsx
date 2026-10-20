import { useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { marketSearch } from '@/lib/market';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { MessageCircle, Megaphone, Send } from 'lucide-react';
import { Button } from './ui/button';
import { adminListNotices, adminListQna, adminReplyAsSeller, type QnaRow } from '@/lib/admin-boards.functions';

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

function QnaItem({ row, onDone }: { row: QnaRow; onDone: () => void }) {
  const reply = useServerFn(adminReplyAsSeller);
  const [open, setOpen] = useState(false), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await reply({ data: { commentId: row.id, body: text } }); toast.success(`${row.seller_name} 이름으로 답변을 등록했습니다.`); setText(''); setOpen(false); onDone(); }
    catch (e) { toast.error((e as Error).message || '답변을 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <article className="border-b border-border py-4">
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><strong className="text-primary">{row.seller_name}</strong><span>·</span><Link to="/post/$id" params={{ id: row.post_id }} className="underline">{row.post_title}</Link><span>·</span><time>{when(row.created_at)}</time>{row.answered ? <span className="rounded bg-muted px-2 py-0.5">답변 완료</span> : <span className="rounded bg-destructive px-2 py-0.5 text-destructive-foreground">답변 대기</span>}</div>
    <p className="mt-2 text-sm"><strong>{row.author}</strong> · <span className="whitespace-pre-wrap">{row.body}</span></p>
    {row.replies.map(r => <p key={r.id} className="mt-2 ml-4 border-l-2 border-primary pl-3 text-sm"><strong>{r.creator}</strong>{r.by_seller && <span className="ml-1 text-xs text-primary">셀러</span>} · <span className="whitespace-pre-wrap">{r.body}</span><time className="ml-2 text-xs text-muted-foreground">{when(r.created_at)}</time></p>)}
    {row.canReply && (open
      ? <div className="mt-3 space-y-2"><textarea className="form-input w-full" rows={3} maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder={`${row.seller_name} 이름으로 등록됩니다`} aria-label="관리자 답변"/><div className="flex gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>취소</Button><Button variant="gold" disabled={busy || !text.trim()} onClick={() => void send()}><Send size={14}/>{row.seller_name} 이름으로 답변</Button></div></div>
      : <Button variant="goldOutline" size="sm" className="mt-3" onClick={() => setOpen(true)}>답변 달기</Button>)}
  </article>;
}

export function AdminBoards() {
  const first = marketSearch.parse(useRouterState({ select: s => s.location.search })).boardTab;
  const [tab, setTab] = useState<'qna' | 'notices'>(first ?? 'qna'), [pending, setPending] = useState(false);
  const client = useQueryClient(), listQna = useServerFn(adminListQna), listNotices = useServerFn(adminListNotices);
  const qna = useQuery({ queryKey: ['admin-qna', pending], enabled: tab === 'qna', queryFn: () => listQna({ data: { pendingOnly: pending } }), refetchInterval: 30_000 });
  const notices = useQuery({ queryKey: ['admin-notices'], enabled: tab === 'notices', queryFn: () => listNotices(), refetchInterval: 60_000 });
  return <section className="mt-4">
    <div className="flex flex-wrap gap-2 border-b border-border pb-3"><Button variant={tab === 'qna' ? 'goldOutline' : 'ghost'} onClick={() => setTab('qna')}><MessageCircle/>질문 게시판</Button><Button variant={tab === 'notices' ? 'goldOutline' : 'ghost'} onClick={() => setTab('notices')}><Megaphone/>공지 게시판</Button><Button asChild variant="ghost"><Link to="/admin" search={{ role: 'admin', section: 'reviews' }}>리뷰 게시판 →</Link></Button></div>
    {tab === 'qna' ? <>
      <div className="flex items-center gap-2 py-3"><Button size="sm" variant={pending ? 'ghost' : 'goldOutline'} onClick={() => setPending(false)}>전체</Button><Button size="sm" variant={pending ? 'goldOutline' : 'ghost'} onClick={() => setPending(true)}>답변 대기만</Button><span className="text-xs text-muted-foreground">관리자 답변은 해당 셀러 이름으로 등록됩니다.</span></div>
      {qna.isError ? <p role="alert" className="text-destructive">문의를 불러오지 못했습니다.</p> : qna.isLoading ? <p>불러오는 중…</p> : !qna.data?.length ? <p className="py-6 text-center text-sm text-muted-foreground">문의가 없습니다.</p> : qna.data.map(r => <QnaItem key={r.id} row={r} onDone={() => void client.invalidateQueries({ queryKey: ['admin-qna'] })}/>)}
    </> : notices.isError ? <p role="alert" className="py-3 text-destructive">공지를 불러오지 못했습니다.</p> : notices.isLoading ? <p className="py-3">불러오는 중…</p> : !notices.data?.length ? <p className="py-6 text-center text-sm text-muted-foreground">등록된 공지가 없습니다.</p> : notices.data.map(n => <article key={n.id} className="border-b border-border py-4"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><strong className="text-primary">{n.seller_name}</strong><span>·</span><time>{when(n.created_at)}</time></div><h3 className="mt-1 font-semibold">{n.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p></article>)}
  </section>;
}
