import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { saveStoreContent } from '@/lib/store-content.functions';
import { canEditStoreContent } from '@/lib/store-content';
import { useMyAccount } from './seller-account';
import { useCurrency } from './currency';
import { Button } from './ui/button';
import { Tx } from './tx';
import { TranslatableText } from './translatable-text';

export function SellerStoreContent({ sellerId }: { sellerId: string }) {
  const { lang } = useCurrency(), client = useQueryClient(), save = useServerFn(saveStoreContent);
  const auth = useQuery({ queryKey: ['auth-user'], queryFn: async () => (await supabase.auth.getUser()).data.user });
  const account = useMyAccount(auth.data ?? null);
  const editable = canEditStoreContent(auth.data?.id, sellerId, account.data?.roles ?? []);
  const q = useQuery({ queryKey: ['seller-store-content', sellerId], queryFn: async () => {
    const [intro, notices] = await Promise.all([
      supabase.from('seller_store_content').select('introduction').eq('user_id', sellerId).maybeSingle(),
      supabase.from('seller_store_notices').select('id,title,body,created_at').eq('user_id', sellerId).order('created_at', { ascending: false }),
    ]);
    if (intro.error || notices.error) throw new Error('불러오지 못했습니다.');
    return { introduction: intro.data?.introduction ?? '', notices: notices.data ?? [] };
  } });
  const [editing, setEditing] = useState(false), [intro, setIntro] = useState(''), [notice, setNotice] = useState<{ id?: string; title: string; body: string } | null>(null), [busy, setBusy] = useState(false), [deleting, setDeleting] = useState<string | null>(null);
  async function commit(data: { kind: 'introduction'; introduction: string } | { kind: 'notice'; id?: string; title: string; body: string } | { kind: 'delete'; id: string }) {
    setBusy(true);
    try { await save({ data }); await client.invalidateQueries({ queryKey: ['seller-store-content', sellerId] }); setEditing(false); setNotice(null); setDeleting(null); toast.success('저장했습니다.'); }
    catch { toast.error('저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  return <section className="my-6 min-w-0 space-y-6 notranslate" translate="no" data-no-translate>
    {q.isError && <p role="alert" className="text-destructive"><Tx>스토어 내용을 불러오지 못했습니다.</Tx></p>}
    <div className="border-y border-border py-5">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold"><Tx>스토어 소개</Tx></h2>{editable && !editing && <Button variant="ghost" size="sm" onClick={() => { setIntro(q.data?.introduction ?? ''); setEditing(true); }}><Pencil size={14}/><Tx>편집</Tx></Button>}</div>
      {editable && editing ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void commit({ kind: 'introduction', introduction: intro }); }}><textarea aria-label="스토어 소개" className="form-input min-h-32 w-full" maxLength={3000} value={intro} onChange={e => setIntro(e.target.value)}/><div className="flex gap-2"><Button variant="gold" type="submit" disabled={busy}><Save size={14}/><Tx>저장</Tx></Button><Button variant="ghost" onClick={() => setEditing(false)}><Tx>취소</Tx></Button></div></form> : q.data?.introduction ? <TranslatableText as="p" className="whitespace-pre-wrap break-words text-sm text-muted-foreground" text={q.data.introduction}/> : <p className="text-sm text-muted-foreground"><Tx>{q.isLoading ? '불러오는 중…' : '등록된 스토어 소개가 없습니다.'}</Tx></p>}
    </div>
    <div><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold"><Tx>공지 게시판</Tx></h2>{editable && !notice && <Button variant="goldOutline" size="sm" onClick={() => setNotice({ title: '', body: '' })}><Plus size={14}/><Tx>공지 작성</Tx></Button>}</div>
      {editable && notice && <form className="mb-5 space-y-3" onSubmit={e => { e.preventDefault(); void commit({ kind: 'notice', ...notice }); }}><input className="form-input w-full" aria-label="공지 제목" placeholder="공지 제목" required maxLength={120} value={notice.title} onChange={e => setNotice({ ...notice, title: e.target.value })}/><textarea className="form-input min-h-32 w-full" aria-label="공지 내용" placeholder="공지 내용" required maxLength={5000} value={notice.body} onChange={e => setNotice({ ...notice, body: e.target.value })}/><div className="flex gap-2"><Button type="submit" variant="gold" disabled={busy || !notice.title.trim() || !notice.body.trim()}><Save size={14}/><Tx>저장</Tx></Button><Button variant="ghost" onClick={() => setNotice(null)}><Tx>취소</Tx></Button></div></form>}
      {q.data?.notices.map(n => <article key={n.id} className="border-b border-border py-4"><div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words font-semibold"><TranslatableText text={n.title}/></h3>{editable && <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" aria-label="공지 수정" title="공지 수정" onClick={() => setNotice(n)}><Pencil size={15}/></Button><Button variant="ghost" size="icon" aria-label="공지 삭제" title="공지 삭제" onClick={() => setDeleting(n.id)}><Trash2 size={15}/></Button></div>}</div><time className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString(lang)}</time><TranslatableText as="p" className="mt-3 whitespace-pre-wrap break-words text-sm" text={n.body}/>{deleting === n.id && editable && <div className="mt-3 flex flex-wrap items-center gap-2"><Tx>공지를 삭제할까요?</Tx><Button variant="goldOutline" disabled={busy} onClick={() => void commit({ kind: 'delete', id: n.id })}><Tx>삭제</Tx></Button><Button variant="ghost" onClick={() => setDeleting(null)}><Tx>취소</Tx></Button></div>}</article>)}
      {!q.isLoading && !q.data?.notices.length && <p className="py-4 text-sm text-muted-foreground"><Tx>등록된 공지가 없습니다.</Tx></p>}
    </div>
  </section>;
}