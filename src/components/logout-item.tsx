import { tx } from '@/lib/dom-translate';
import { useCurrency } from './currency';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, ShieldQuestion } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

export function LogoutItem() {
  const { lang } = useCurrency();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      await navigate({ to: '/', replace: true });
    } finally {
      setBusy(false);
    }
  };
  return <div className="account-logout">
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="account-logout-button" disabled={busy}>
          <LogOut size={18}/><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("로그아웃")}</span></Button>
      </AlertDialogTrigger>
      <AlertDialogContent lang={lang} translate="no" className="notranslate" data-no-translate>
        <AlertDialogHeader>
          <ShieldQuestion className="mx-auto text-primary" size={30}/>
          <AlertDialogTitle><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("로그아웃 전에 확인하세요")}</span></AlertDialogTitle>
          <AlertDialogDescription>
            <span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("로그아웃하기 전에")}</span><strong><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("가입 때 등록한 전화번호와 비밀번호")}</span></strong><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("를 잊지 마세요. 다시 로그인할 때 동일한 전화번호와 비밀번호가 필요합니다.")}</span></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("취소")}</span></AlertDialogCancel>
          <AlertDialogAction onClick={() => void signOut()}><span data-i18n-skip data-no-translate translate="no" className="notranslate">{tx("로그아웃")}</span></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
