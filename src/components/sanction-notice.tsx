import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { activeLang, type Lang } from '@/lib/i18n';
import { Button } from './ui/button';

type Sanction = { id: string; kind: 'suspend' | 'ban'; reason: string; ends_at: string | null };
type Copy = { suspend: string; ban: string; body: string; until: string; reason: string; ok: string };

/** Shown once per session when a suspended member signs in. Written out per language so it never depends on the dictionary. */
const COPY: Record<Lang, Copy> = {
  en: { suspend: 'Your account is suspended', ban: 'Your account is permanently suspended', body: 'Commenting, reviews and purchases are blocked while the suspension lasts. This protects buyers and sellers from fraud and abuse.', until: 'Suspended until', reason: 'Reason', ok: 'I understand' },
  ko: { suspend: '계정 이용이 정지되었습니다', ban: '계정이 영구 정지되었습니다', body: '정지 기간 동안 댓글·리뷰 작성과 구매가 제한됩니다. 이는 사기와 비방으로부터 구매자와 판매자를 보호하기 위한 조치입니다.', until: '정지 종료일', reason: '사유', ok: '확인했습니다' },
  zh: { suspend: '您的账户已被暂停', ban: '您的账户已被永久封禁', body: '暂停期间无法发表评论、评价或购买。此措施旨在保护买家和卖家免受欺诈和恶意攻击。', until: '暂停至', reason: '原因', ok: '我已了解' },
  ja: { suspend: 'アカウントが停止されました', ban: 'アカウントが永久停止されました', body: '停止期間中はコメント・レビューの投稿と購入ができません。これは詐欺や誹謗中傷から買い手と売り手を守るための措置です。', until: '停止期限', reason: '理由', ok: '確認しました' },
  it: { suspend: 'Il tuo account è sospeso', ban: 'Il tuo account è sospeso in modo permanente', body: 'Durante la sospensione non puoi commentare, scrivere recensioni o acquistare. Serve a proteggere acquirenti e venditori da frodi e abusi.', until: 'Sospeso fino al', reason: 'Motivo', ok: 'Ho capito' },
  fr: { suspend: 'Votre compte est suspendu', ban: 'Votre compte est définitivement suspendu', body: "Pendant la suspension, vous ne pouvez ni commenter, ni laisser d'avis, ni acheter. Cette mesure protège acheteurs et vendeurs contre la fraude et les abus.", until: "Suspendu jusqu'au", reason: 'Motif', ok: "J'ai compris" },
  de: { suspend: 'Ihr Konto ist gesperrt', ban: 'Ihr Konto ist dauerhaft gesperrt', body: 'Während der Sperre sind Kommentare, Bewertungen und Käufe nicht möglich. Das schützt Käufer und Verkäufer vor Betrug und Missbrauch.', until: 'Gesperrt bis', reason: 'Grund', ok: 'Verstanden' },
  nl: { suspend: 'Je account is geschorst', ban: 'Je account is permanent geblokkeerd', body: 'Tijdens de schorsing kun je geen reacties, beoordelingen of aankopen plaatsen. Dit beschermt kopers en verkopers tegen fraude en misbruik.', until: 'Geschorst tot', reason: 'Reden', ok: 'Begrepen' },
  ru: { suspend: 'Ваш аккаунт приостановлен', ban: 'Ваш аккаунт заблокирован навсегда', body: 'Во время приостановки нельзя оставлять комментарии, отзывы и совершать покупки. Это защищает покупателей и продавцов от мошенничества и оскорблений.', until: 'Приостановлен до', reason: 'Причина', ok: 'Понятно' },
  la: { suspend: 'Ratio tua suspensa est', ban: 'Ratio tua in perpetuum suspensa est', body: 'Dum suspensio durat, commentari, recensere et emere non licet. Hoc emptores et venditores a fraude et iniuria tuetur.', until: 'Suspensa usque ad', reason: 'Causa', ok: 'Intellexi' },
  ar: { suspend: 'تم تعليق حسابك', ban: 'تم حظر حسابك نهائيًا', body: 'أثناء فترة التعليق لا يمكنك التعليق أو كتابة التقييمات أو الشراء. يهدف ذلك إلى حماية المشترين والبائعين من الاحتيال والإساءة.', until: 'معلّق حتى', reason: 'السبب', ok: 'فهمت' },
};
const rpc = (name: string) => (supabase as unknown as { rpc: (n: string) => Promise<{ data: unknown; error: unknown }> }).rpc(name);

export function SanctionNotice() {
  const [uid, setUid] = useState<string | null>(null);
  const [s, setS] = useState<Sanction | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUid(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!uid) { setS(null); return; }
    let live = true;
    void rpc('my_active_sanction').then(({ data }) => {
      const found = data as Sanction | null;
      if (!live || !found?.id) return;
      try { if (sessionStorage.getItem(`vela.sanction.${found.id}`)) return; } catch { /* ignore */ }
      setS(found);
    });
    return () => { live = false; };
  }, [uid]);
  const close = () => { if (s) { try { sessionStorage.setItem(`vela.sanction.${s.id}`, '1'); } catch { /* ignore */ } } setS(null); };
  if (!s) return null;
  const lang = activeLang(), c = COPY[lang] ?? COPY.en;
  const date = s.ends_at ? new Date(s.ends_at).toLocaleDateString(lang === 'la' ? 'it' : lang) : null;
  return <Dialog.Root open onOpenChange={o => { if (!o) close(); }}><Dialog.Portal><Dialog.Overlay className="drawer-backdrop auth-backdrop"/>
    <Dialog.Content className="auth-dialog" aria-describedby={undefined} data-no-translate dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Dialog.Title className="flex items-center gap-2 text-lg font-bold"><ShieldAlert className="text-destructive" size={22}/>{s.kind === 'ban' ? c.ban : c.suspend}</Dialog.Title>
      <p className="mt-3 text-sm leading-6">{c.body}</p>
      {date && <p className="mt-3 text-sm"><strong>{c.until}:</strong> {date}</p>}
      {s.reason && <p className="mt-1 text-sm"><strong>{c.reason}:</strong> {s.reason}</p>}
      <Button className="mt-5 w-full" onClick={close}>{c.ok}</Button>
    </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
