import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { rememberReferral } from '@/lib/referral';

/**
 * 추천 링크: /ref/<추천 코드> — 방문 기록(7일)을 남기고, 로그인 전이면 코드가 적용된 가입 화면으로 보낸다.
 * (서버에서 바로 리다이렉트하면 브라우저에 기록을 남길 수 없어서, 화면이 열린 뒤 브라우저에서 처리한다.)
 */
export const Route = createFileRoute('/ref/$code')({ component: RefLanding });

function RefLanding() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    rememberReferral(code);
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      void navigate({ to: '/', search: (data.session ? {} : { auth: true, authSignup: true }) as never, replace: true });
    });
    return () => { alive = false; };
  }, [code, navigate]);
  return null;
}
