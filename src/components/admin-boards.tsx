import { useEffect, useRef, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { MessageCircle, Megaphone, Send, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { TranslatableText } from './translatable-text';
import { marketSearch } from '@/lib/market';
import { adminDeleteComment, adminDeleteNotice, adminListNotices, adminListQna, adminReplyAsSeller, type QnaRow } from '@/lib/admin-boards.functions';

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

/** 삭제 버튼: 한 번 누르면 "정말 삭제"로 바뀌고, 한 번 더 눌러야 삭제됩니다. */
function DeleteButton({ onConfirm, label = '삭제' }: { onConfirm: () => Promise<void>; label?: string }) {
  const [armed, setArmed] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <Button type="button" variant={armed ? 'destructive' : 'ghost'} size="sm" disabled={busy} onClick={async () => { if (!armed) { setArmed(true); return; } setBusy(true); try { await onConfirm(); } finally { setBusy(false); setArmed(false); } }}><Trash2 size={14}/>{armed ? '정말 삭제' : label}</Button>;
}

function QnaItem({ row, focus, onDone }: { row: QnaRow; focus: boolean; onDone: () => void }) {
  const reply = useServerFn(adminReplyAsSeller), del = useServerFn(adminDeleteComment);
  const [open, setOpen] = useState(focus), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (focus) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [focus]);
  const send = async () => {
    setBusy(true);
    try { await reply({ data: { commentId: row.id, body: text } }); toast.success(`${row.seller_name} 이름으로 답변을 등록했습니다.`); setText(''); setOpen(false); onDone(); }
    catch (e) { toast.error((e as Error).message || '답변을 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const remove = (id: string) => async () => { try { await del({ data: { commentId: id } }); toast.success('삭제했습니다.'); onDone(); } catch (e) { toast.error((e as Error).message || '삭제하지 못했습니다.'); } };
  return <article ref={ref} className={`border-b border-border py-4 ${focus ? 'rounded-md border border-primary bg-primary/5 px-3' : ''}`}>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>셀러</span><strong className="text-primary">{row.seller_name}</strong><span>·</span><Link to="/post/$id" params={{ id: row.post_id }} className="underline">{row.post_title}</Link><span>·</span><time>{when(row.created_at)}</time>{row.answered ? <span className="rounded bg-muted px-2 py-0.5">답변 완료</span> : <span className="rounded bg-destructive px-2 py-0.5 text-destructive-foreground">답변 대기</span>}</div>
    <div className="mt-2 flex items-start justify-between gap-2"><p className="min-w-0 text-sm"><strong>{row.author}</strong> · <TranslatableText as="span" className="whitespace-pre-wrap" text={row.body}/></p><DeleteButton onConfirm={remove(row.id)}/></div>
    {row.replies.map(r => <div key={r.id} className="mt-2 ml-4 flex items-start justify-between gap-2 border-l-2 border-primary pl-3 text-sm"><p className="min-w-0"><strong>{r.creator}</strong>{r.by_seller && <span className="ml-1 text-xs text-primary">셀러</span>} · <TranslatableText as="span" className="whitespace-pre-wrap" text={r.body}/><time className="ml-2 text-xs text-muted-foreground">{when(r.created_at)}</time></p><DeleteButton onConfirm={remove(r.id)}/></div>)}
    {row.canReply && (open
      ? <div className="mt-3 space-y-2"><textarea className="form-input w-full" rows={3} maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder={`${row.seller_name} 이름으로 등록됩니다`} aria-label="관리자 답변" autoFocus={focus}/><div className="flex gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>취소</Button><Button variant="gold" disabled={busy || !text.trim()} onClick={() => void send()}><Send size={14}/>{row.seller_name} 이름으로 답변</Button></div></div>
      : <Button variant="goldOutline" size="sm" className="mt-3" onClick={() => setOpen(true)}>답변 달기</Button>)}
  </article>;
}

export function AdminBoards() {
  const search = marketSearch.parse(useRouterState({ select: s => s.location.search }));
  const focusId = search.boardItem;
  const [tab, setTab] = useState<'qna' | 'notices'>(search.boardTab ?? 'qna'), [pending, setPending] = useState(false);
  const client = useQueryClient(), listQna = useServerFn(adminListQna), listNotices = useServerFn(adminListNotices), delNotice = useServerFn(adminDeleteNotice);
  const qna = useQuery({ queryKey: ['admin-qna', pending], enabled: tab === 'qna', queryFn: () => listQna({ data: { pendingOnly: pending } }), refetchInterval: 30_000 });
  const notices = useQuery({ queryKey: ['admin-notices'], enabled: tab === 'notices', queryFn: () => listNotices(), refetchInterval: 60_000 });
  const sorted = qna.data ? [...qna.data].sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId)) : [];
  return <section className="mt-4">
    <div className="flex flex-wrap gap-2 border-b border-border pb-3"><Button variant={tab === 'qna' ? 'goldOutline' : 'ghost'} onClick={() => setTab('qna')}><MessageCircle/>질문 게시판</Button><Button variant={tab === 'notices' ? 'goldOutline' : 'ghost'} onClick={() => setTab('notices')}><Megaphone/>공지 게시판</Button><Button asChild variant="ghost"><Link to="/admin" search={{ role: 'admin', section: 'reviews' }}>리뷰 게시판 →</Link></Button></div>
    {tab === 'qna' ? <>
      <div className="flex items-center gap-2 py-3"><Button size="sm" variant={pending ? 'ghost' : 'goldOutline'} onClick={() => setPending(false)}>전체</Button><Button size="sm" variant={pending ? 'goldOutline' : 'ghost'} onClick={() => setPending(true)}>답변 대기만</Button><span className="text-xs text-muted-foreground">관리자 답변은 해당 셀러 이름으로 등록됩니다.</span></div>
      {qna.isError ? <p role="alert" className="text-destructive">문의를 불러오지 못했습니다.</p> : qna.isLoading ? <p>불러오는 중…</p> : !sorted.length ? <p className="py-6 text-center text-sm text-muted-foreground">문의가 없습니다.</p> : sorted.map(r => <QnaItem key={r.id} row={r} focus={r.id === focusId} onDone={() => void client.invalidateQueries({ queryKey: ['admin-qna'] })}/>)}
    </> : notices.isError ? <p role="alert" className="py-3 text-destructive">공지를 불러오지 못했습니다.</p> : notices.isLoading ? <p className="py-3">불러오는 중…</p> : !notices.data?.length ? <p className="py-6 text-center text-sm text-muted-foreground">등록된 공지가 없습니다.</p> : [...notices.data].sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId)).map(n => <article key={n.id} className={`border-b border-border py-4 ${n.id === focusId ? 'rounded-md border border-primary bg-primary/5 px-3' : ''}`}><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>셀러</span><strong className="text-primary">{n.seller_name}</strong><span>·</span><time>{when(n.created_at)}</time></div><div className="mt-1 flex items-start justify-between gap-2"><TranslatableText as="p" className="min-w-0 font-semibold" text={n.title}/><DeleteButton onConfirm={async () => { try { await delNotice({ data: { noticeId: n.id } }); toast.success('삭제했습니다.'); void client.invalidateQueries({ queryKey: ['admin-notices'] }); } catch (e) { toast.error((e as Error).message || '삭제하지 못했습니다.'); } }}/></div><TranslatableText as="p" className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground" text={n.body}/></article>)}
  </section>;
}
