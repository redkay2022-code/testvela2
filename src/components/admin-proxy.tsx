import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { createProxySellers } from '@/lib/proxy-seller.functions';
import { SellerListings } from './seller-listings';
import type { ProxyTarget } from './member-picker';

export const PROXY_TAB_LABEL = '셀러 대리 관리';
export const PROXY_TAB_NOTE = '셀러 계정 만들기 · 셀러 대신 상품 등록·수정·삭제';

const clean = (q: string) => q.replace(/[%,()"'\\*]/g, ' ').trim().slice(0, 40);

/** 관리자 백오피스 > 셀러 대리 관리: 셀러 계정을 만들고, 고른 셀러의 상품 관리 화면(일반 셀러와 동일)을 그대로 연다. */
export function AdminProxy() {
  const qc = useQueryClient();
  const createFn = useServerFn(createProxySellers);
  const [target, setTarget] = useState<ProxyTarget | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [onlySellers, setOnlySellers] = useState(true);
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const members = useQuery({
    queryKey: ['proxy-admin-members', search, onlySellers],
    queryFn: async () => {
      let ids: string[] | null = null;
      if (onlySellers) {
        const { data: roles, error: re } = await supabase.from('user_roles').select('user_id').eq('role', 'seller').limit(500);
        if (re) throw re;
        ids = (roles ?? []).map(r => r.user_id);
        if (!ids.length) return [];
      }
      let query = supabase.from('profiles').select('user_id,nickname,system_code').order('created_at', { ascending: false }).limit(60);
      if (ids) query = query.in('user_id', ids);
      const q = clean(search);
      if (q) query = query.or(`nickname.ilike.%${q}%,system_code.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const sellers = new Set<string>(ids ?? []);
      if (!ids && rows.length) {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'seller').in('user_id', rows.map(r => r.user_id));
        (roles ?? []).forEach(r => sellers.add(r.user_id));
      }
      return rows.map(r => ({ id: r.user_id, nickname: r.nickname, code: r.system_code, seller: sellers.has(r.user_id) }));
    },
  });

  const create = async () => {
    const list = names.split('\n').map(n => n.trim()).filter(Boolean);
    if (!list.length) { setNote('닉네임을 한 줄에 하나씩 입력해 주세요.'); return; }
    if (list.length > 10) { setNote('한 번에 최대 10개까지 만들 수 있어요.'); return; }
    if (list.some(n => n.length > 30)) { setNote('닉네임은 30자 이하로 입력해 주세요.'); return; }
    setBusy(true); setNote('');
    try {
      const res = await createFn({ data: { nicknames: list } });
      setNote(`${res.created.length}개 계정을 만들었어요.${res.failed.length ? ` 만들지 못한 닉네임: ${res.failed.join(', ')}` : ''}`);
      if (res.created.length) { setNames(''); setSearch(''); setInput(''); setOnlySellers(true); void qc.invalidateQueries({ queryKey: ['proxy-admin-members'] }); }
    } catch { setNote('계정을 만들지 못했어요. 관리자 로그인 상태인지 확인하고 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };

  return <div className="notranslate space-y-6" translate="no" data-no-translate="">
    {target ? <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary bg-primary/10 p-3">
        <p className="text-sm font-semibold">지금 “{target.nickname}” 셀러의 상품을 관리하고 있어요.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setTarget(null)}>셀러 목록으로 돌아가기</Button>
      </div>
      <SellerListings key={target.id} actAs={target} />
    </div> : <>
      <section className="seller-flow-card">
        <h2 className="text-lg font-semibold">셀러 선택</h2>
        <p className="mt-1 text-xs text-muted-foreground">셀러를 고르면 그 셀러의 “내 상품 관리” 화면이 열립니다. 새 상품 등록·수정·삭제를 일반 셀러처럼 할 수 있어요.</p>
        <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(input); }}>
          <input className="form-input min-w-0 flex-1" aria-label="회원 검색" placeholder="닉네임 또는 코드(VELA_…) 검색" maxLength={40} value={input} onChange={e => setInput(e.target.value)} />
          <Button type="submit" size="sm" variant="outline">검색</Button>
        </form>
        <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={onlySellers} onChange={e => setOnlySellers(e.target.checked)} />셀러 계정만 보기</label>
        <div className="mt-3">
          {members.isLoading ? <p className="text-xs text-muted-foreground">불러오는 중…</p> : members.isError ? <p className="text-xs text-destructive">목록을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.</p> : !members.data?.length ? <p className="text-xs text-muted-foreground">표시할 셀러가 없어요. 아래에서 셀러 계정을 먼저 만들어 주세요.</p> :
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {members.data.map(m => <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{m.nickname} <span className="text-xs text-muted-foreground">{m.code}</span></span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`text-xs ${m.seller ? 'text-primary' : 'text-muted-foreground'}`}>{m.seller ? '셀러' : '일반 회원'}</span>
                  <Button type="button" size="sm" disabled={!m.seller} onClick={() => setTarget({ id: m.id, nickname: m.nickname, seller: m.seller })}>상품 관리</Button>
                </span>
              </li>)}
            </ul>}
        </div>
      </section>
      <section className="seller-flow-card">
        <h2 className="text-lg font-semibold">셀러 계정 만들기</h2>
        <p className="mt-1 text-xs text-muted-foreground">닉네임을 한 줄에 하나씩, 한 번에 최대 10개까지 입력하세요. 로그인할 수 없는 승인된 셀러 계정이 만들어지고, 위 목록에서 바로 상품을 올릴 수 있어요.</p>
        <textarea className="form-input mt-2 min-h-24" aria-label="새 계정 닉네임 목록" placeholder={'닉네임1\n닉네임2\n…'} maxLength={400} value={names} onChange={e => setNames(e.target.value)} />
        <Button type="button" size="sm" className="mt-2" disabled={busy} onClick={() => void create()}>{busy ? '만드는 중…' : '계정 만들기'}</Button>
        {note && <p role="status" className="mt-2 text-xs text-muted-foreground">{note}</p>}
      </section>
    </>}
  </div>;
}
