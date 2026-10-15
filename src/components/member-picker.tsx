import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { createProxySellers } from '@/lib/proxy-seller.functions';

/** 관리자가 대신 등록·관리할 회원. seller=true 는 승인된 셀러 계정(상품 등록 가능). */
export type ProxyTarget = { id: string; nickname: string; seller: boolean };

export const PROXY_NOT_SELLER_MESSAGE = '선택한 회원은 승인된 셀러가 아니라서 상품으로 등록할 수 없어요. 셀러 계정을 선택하거나 “마켓에 판매하기”를 해제해 주세요.';

const clean = (q: string) => q.replace(/[%,()"'\\*]/g, ' ').trim().slice(0, 40);

/**
 * 관리자 전용 박스: 다른 회원(셀러) 이름으로 상품을 올리거나 관리하도록 대상을 고르고,
 * 로그인 없이 대신 등록용으로만 쓰는 셀러 계정을 만든다. 관리자가 아니면 아무것도 보이지 않는다.
 */
export function MemberPicker({ userId, value, onChange }: { userId: string; value: ProxyTarget | null; onChange: (next: ProxyTarget | null) => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProxySellers);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const admin = useQuery({
    queryKey: ['is-admin', userId],
    queryFn: async () => { const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }); return Boolean(data); },
    staleTime: 5 * 60_000,
  });
  const members = useQuery({
    queryKey: ['proxy-members', search],
    enabled: admin.data === true && open,
    queryFn: async () => {
      let query = supabase.from('profiles').select('user_id,nickname,system_code').order('created_at', { ascending: false }).limit(30);
      const q = clean(search);
      if (q) query = query.or(`nickname.ilike.%${q}%,system_code.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map(r => r.user_id);
      const sellers = new Set<string>();
      if (ids.length) {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'seller').in('user_id', ids);
        (roles ?? []).forEach(r => sellers.add(r.user_id));
      }
      return rows.map(r => ({ id: r.user_id, nickname: r.nickname, code: r.system_code, seller: sellers.has(r.user_id) }));
    },
  });

  if (!admin.data) return null;

  const create = async () => {
    const list = names.split('\n').map(n => n.trim()).filter(Boolean);
    if (!list.length) { setNote('닉네임을 한 줄에 하나씩 입력해 주세요.'); return; }
    if (list.length > 10) { setNote('한 번에 최대 10개까지 만들 수 있어요.'); return; }
    if (list.some(n => n.length > 30)) { setNote('닉네임은 30자 이하로 입력해 주세요.'); return; }
    setBusy(true); setNote('');
    try {
      const res = await createFn({ data: { nicknames: list } });
      setNote(`${res.created.length}개 계정을 만들었어요.${res.failed.length ? ` 만들지 못한 닉네임: ${res.failed.join(', ')}` : ''}`);
      if (res.created.length) { setNames(''); setSearch(''); setInput(''); void qc.invalidateQueries({ queryKey: ['proxy-members'] }); }
    } catch { setNote('계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };

  return <div className="notranslate mt-4 rounded-lg border border-input bg-muted/40 p-3" translate="no" data-no-translate="">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold text-primary">관리자 대리 등록·관리</p>
      <Button type="button" size="sm" variant="goldOutline" onClick={() => setOpen(o => !o)}>{open ? '닫기' : '회원 선택'}</Button>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">{value ? `지금 “${value.nickname}” 계정으로 등록·관리 중입니다.` : '선택하지 않으면 내 계정으로 등록·관리합니다.'}</p>
    {value && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => onChange(null)}>선택 해제 (내 계정으로)</Button>}
    {open && <div className="mt-3 space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(input); }}>
        <input className="form-input min-w-0 flex-1" aria-label="회원 검색" placeholder="닉네임 또는 코드(VELA_…) 검색" maxLength={40} value={input} onChange={e => setInput(e.target.value)} />
        <Button type="submit" size="sm" variant="outline">검색</Button>
      </form>
      {members.isLoading ? <p className="text-xs text-muted-foreground">불러오는 중…</p> : !members.data?.length ? <p className="text-xs text-muted-foreground">검색된 회원이 없어요.</p> :
        <ul className="max-h-60 space-y-1 overflow-y-auto" role="listbox" aria-label="회원 목록">
          {members.data.map(m => <li key={m.id}><button type="button" role="option" aria-selected={value?.id === m.id} className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${value?.id === m.id ? 'border-primary bg-primary/10' : 'border-input bg-background'}`} onClick={() => { onChange({ id: m.id, nickname: m.nickname, seller: m.seller }); setOpen(false); }}>
            <span className="min-w-0 truncate">{m.nickname} <span className="text-xs text-muted-foreground">{m.code}</span></span>
            <span className={`shrink-0 text-xs ${m.seller ? 'text-primary' : 'text-muted-foreground'}`}>{m.seller ? '셀러' : '일반 회원'}</span>
          </button></li>)}
        </ul>}
      <div className="border-t border-input pt-3">
        <p className="text-sm font-semibold">대리 등록용 셀러 계정 만들기</p>
        <p className="mt-1 text-xs text-muted-foreground">닉네임을 한 줄에 하나씩, 한 번에 최대 10개까지 입력하세요. 로그인할 수 없는 승인된 셀러 계정이 만들어집니다.</p>
        <textarea className="form-input mt-2 min-h-24" aria-label="새 계정 닉네임 목록" placeholder={'닉네임1\n닉네임2\n…'} maxLength={400} value={names} onChange={e => setNames(e.target.value)} />
        <Button type="button" size="sm" className="mt-2" disabled={busy} onClick={() => void create()}>{busy ? '만드는 중…' : '계정 만들기'}</Button>
        {note && <p role="status" className="mt-2 text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>}
  </div>;
}
