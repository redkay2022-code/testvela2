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
          <LogOut size={18}/>{tx("로그아웃")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent lang={lang} translate="no" className="notranslate" data-no-translate>
        <AlertDialogHeader>
          <ShieldQuestion className="mx-auto text-primary" size={30}/>
          <AlertDialogTitle>{tx("로그아웃 전에 확인하세요")}</AlertDialogTitle>
          <AlertDialogDescription>
            {tx("로그아웃하기 전에")}<strong>{tx("가입 때 등록한 전화번호와 비밀번호")}</strong>{tx("를 잊지 마세요.\n            다시 로그인할 때 동일한 전화번호와 비밀번호가 필요합니다.")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tx("취소")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void signOut()}>{tx("로그아웃")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
