import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, ShieldQuestion } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

export function LogoutItem() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      await navigate({ to: '/auth', replace: true });
    } finally {
      setBusy(false);
    }
  };
  return <div className="account-logout">
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="account-logout-button" disabled={busy}>
          <LogOut size={18}/>로그아웃
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent lang="ko" data-no-translate>
        <AlertDialogHeader>
          <ShieldQuestion className="mx-auto text-primary" size={30}/>
          <AlertDialogTitle>로그아웃 전에 확인하세요</AlertDialogTitle>
          <AlertDialogDescription>
            로그아웃하기 전에 <strong>가입 때 등록한 전화번호와 비밀번호</strong>를 잊지 마세요.
            다시 로그인할 때 동일한 전화번호와 비밀번호가 필요합니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={() => void signOut()}>로그아웃</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
