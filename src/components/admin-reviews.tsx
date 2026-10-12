import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Star, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useAdminPasswordGate } from './admin-password-gate';
import { adminDeleteReview, adminHoldReview, adminListReviews } from '@/lib/admin-members.functions';

/** Back-office review moderation: hold (hidden from everyone but the author and admins) or delete permanently. */
export function AdminReviews() {
  const qc = useQueryClient();
  const list = useServerFn(adminListReviews), hold = useServerFn(adminHoldReview), remove = useServerFn(adminDeleteReview);
  const { ask, dialog } = useAdminPasswordGate();
  const [page, setPage] = useState(0), [msg, setMsg] = useState(''), [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin-reviews', page], queryFn: () => list({ data: { page } }), placeholderData: p => p });
  const rows = q.data?.rows ?? [], total = q.data?.total ?? 0, size = q.data?.pageSize ?? 20;
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-reviews'] });

  const toggle = async (id: string, held: boolean) => {
    setBusy(id); setMsg('');
    try { await hold({ data: { id, held } }); setMsg(held ? '리뷰를 보류했습니다. 작성자와 관리자 외에는 보이지 않습니다.' : '보류를 해제했습니다.'); await refresh(); }
    catch (e) { setMsg(e instanceof Error ? e.message : '처리하지 못했습니다.'); } finally { setBusy(null); }
  };
  const del = async (id: string, who: string) => {
    const password = await ask(`${who}님의 리뷰를 영구 삭제합니다.`);
    if (!password) return;
    setBusy(id); setMsg('');
    try { await remove({ data: { id, password } }); setMsg('리뷰를 삭제했습니다.'); await refresh(); }
    catch (e) { setMsg(e instanceof Error ? e.message : '삭제하지 못했습니다.'); } finally { setBusy(null); }
  };

  return <div className="catalog mt-4" lang="ko" data-no-translate>
    {dialog}
    <div className="section-heading"><h2>리뷰 관리</h2><span>{total}개</span></div>
    <p className="text-xs text-muted-foreground">보류에 체크하면 작성자와 관리자를 제외한 모든 사람에게 리뷰가 보이지 않습니다.</p>
    {msg && <p role="status" className="dashboard-message">{msg}</p>}
    {q.isError ? <p role="alert" className="mt-3 text-sm">리뷰를 불러오지 못했습니다.</p> : <div className="catalog-scroll"><table className="catalog-table"><thead><tr><th>작성자</th><th>판매자</th><th>평점</th><th>내용</th><th>작성일</th><th>보류</th><th>삭제</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id} className={r.held ? 'opacity-60' : ''}>
        <td><strong>{r.nickname}</strong></td><td>{r.seller_name}</td>
        <td>{r.rating ? <span className="inline-flex items-center gap-1"><Star size={13} className="fill-primary text-primary"/>{r.rating}</span> : '—'}</td>
        <td className="max-w-[260px] whitespace-normal text-xs leading-5">{r.body}{r.media > 0 && <small className="block text-muted-foreground">사진·영상 {r.media}개</small>}</td>
        <td>{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
        <td><label className="inline-flex cursor-pointer items-center gap-1 text-xs"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={r.held} disabled={busy === r.id} onChange={e => void toggle(r.id, e.target.checked)}/>보류</label></td>
        <td><Button size="sm" variant="ghost" className="text-destructive" disabled={busy === r.id} onClick={() => void del(r.id, r.nickname)}><Trash2/>삭제</Button></td>
      </tr>)}
      {!rows.length && !q.isLoading && <tr><td colSpan={7} className="text-center text-muted-foreground">리뷰가 없습니다.</td></tr>}
    </tbody></table></div>}
    <div className="mt-3 flex items-center justify-between text-sm"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>이전</Button><span>{page + 1} / {Math.max(1, Math.ceil(total / size))}</span><Button size="sm" variant="ghost" disabled={(page + 1) * size >= total} onClick={() => setPage(p => p + 1)}>다음</Button></div>
  </div>;
}
