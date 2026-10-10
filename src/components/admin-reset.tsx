import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useAdminPasswordGate } from './admin-password-gate';
import { adminResetData, adminResetPreview, type ResetScope } from '@/lib/admin-members.functions';

const SCOPES: { id: ResetScope; title: string; note: string }[] = [
  { id: 'posts', title: '게시물·작업물만 초기화', note: '모든 상품 게시물과 사진·영상, 댓글·좋아요, 주문·정산·QC 기록, 리뷰를 삭제합니다. 회원 계정은 그대로 둡니다.' },
  { id: 'members', title: '가입 회원만 초기화', note: '관리자를 제외한 모든 회원 계정과 그 회원이 올린 상품·주문·리뷰·알림·포인트를 삭제합니다.' },
  { id: 'all', title: '회원 + 게시물 전체 초기화', note: '위 두 가지를 모두 삭제하고 방문 통계도 0으로 되돌립니다. 런칭 전 테스트 데이터를 비울 때 사용하세요.' },
];

/** Back office: wipe test members / listings. Admin accounts, categories and store settings are always kept. */
export function AdminReset() {
  const qc = useQueryClient();
  const preview = useServerFn(adminResetPreview), reset = useServerFn(adminResetData);
  const { ask, dialog } = useAdminPasswordGate();
  const [scope, setScope] = useState<ResetScope>('all'), [word, setWord] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [lines, setLines] = useState<string[]>([]), [warnings, setWarnings] = useState<string[]>([]);
  const counts = useQuery({ queryKey: ['admin-reset-preview'], queryFn: () => preview() });
  const c = counts.data;
  const current = SCOPES.find(s => s.id === scope)!;

  const run = async () => {
    if (busy || word.trim() !== '초기화') return;
    setError(''); setLines([]); setWarnings([]);
    const password = await ask(`${current.title}를 실행합니다. 관리자 계정은 유지되고, 삭제한 데이터는 복구할 수 없습니다.`);
    if (!password) return;
    setBusy(true);
    try {
      const warn: string[] = [];
      let base: string[] = [], deleted = 0;
      const show = () => setLines([...base, ...(scope === 'posts' ? [] : [`회원 계정 ${deleted}명 삭제`])]);
      const first = await reset({ data: { scope, confirm: '초기화', password, phase: 'data' } });
      base = first.lines; warn.push(...first.warnings); show();
      if (scope !== 'posts') {
        let left = 0;
        for (let round = 0; round < 60; round++) {
          const res = await reset({ data: { scope, confirm: '초기화', token: first.token, phase: 'accounts' } });
          deleted += res.deletedMembers; warn.push(...res.warnings); show(); left = res.remainingMembers;
          if (left === 0 || res.deletedMembers === 0) break;
        }
        if (left > 0) warn.push(`회원 ${left}명이 남아 있습니다. 같은 버튼을 다시 눌러 이어서 지워 주세요.`);
      }
      setWarnings([...new Set(warn)]);
      setWord('');
      await qc.invalidateQueries();
    } catch (err) { setError(err instanceof Error && err.message ? err.message : '초기화하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };

  return <section className="seller-section" lang="ko" data-no-translate aria-label="데이터 초기화">
    <div className="flex items-center gap-2"><AlertTriangle className="size-5 text-destructive"/><h2>데이터 초기화</h2></div>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">테스트로 가입한 회원과 올린 게시물을 한 번에 비웁니다. <strong className="text-foreground">관리자 계정, 카테고리, 스토어·셀러 설정은 삭제되지 않습니다.</strong></p>
    <div className="dashboard-stats mt-4">{[
      ['삭제 대상 회원', c ? `${c.members}명` : '—'], ['게시물', c ? `${c.posts}개` : '—'], ['주문', c ? `${c.orders}건` : '—'], ['리뷰', c ? `${c.reviews}개` : '—'], ['댓글', c ? `${c.comments}개` : '—'], ['유지되는 관리자', c ? `${c.admins}명` : '—'],
    ].map(([label, value]) => <div className="stat-item" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div role="radiogroup" aria-label="초기화 범위" className="mt-4 grid gap-2">{SCOPES.map(s => <label key={s.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${scope === s.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
      <input type="radio" name="reset-scope" className="mt-1 accent-primary" checked={scope === s.id} onChange={() => setScope(s.id)}/>
      <span className="min-w-0"><strong className="block text-sm">{s.title}</strong><small className="block text-xs leading-5 text-muted-foreground">{s.note}</small></span></label>)}</div>
    <label className="form-label mt-4" htmlFor="reset-confirm">확인을 위해 <strong>초기화</strong> 라고 입력하세요</label>
    <input id="reset-confirm" className="form-input" value={word} onChange={e => setWord(e.target.value)} placeholder="초기화" autoComplete="off"/>
    <Button type="button" variant="destructive" className="mt-4 w-full" disabled={busy || word.trim() !== '초기화'} onClick={() => void run()}><Trash2/>{busy ? '삭제하는 중… 창을 닫지 마세요' : `${current.title} 실행`}</Button>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {lines.length > 0 && <div role="status" className="mt-4 rounded-lg border border-border p-3 text-sm"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-primary"/>{busy ? '진행 중' : '초기화가 끝났습니다'}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
    {warnings.length > 0 && <div role="alert" className="mt-3 rounded-lg border border-destructive/50 p-3 text-xs leading-5"><p className="font-semibold">일부 항목은 삭제되지 않았습니다. 아래 내용을 알려 주세요.</p><ul className="mt-1 list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
    {dialog}
  </section>;
}
