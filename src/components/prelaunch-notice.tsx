import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useMyAccount } from './seller-account';

/** Pre-launch: catalog is visible to admins/sellers only (enforced by RLS); others see this notice. */
export function PrelaunchNotice() {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(false); const qc = useQueryClient();
  useEffect(() => {
    void supabase.auth.getUser().then(r => { setUser(r.data.user); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return;
      setUser(session?.user ?? null);
      void qc.invalidateQueries({ queryKey: ['posts'] }); void qc.invalidateQueries({ queryKey: ['stores'] });
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  const { data } = useMyAccount(user);
  if (!ready || (user && !data)) return null;
  if (data?.roles.some(r => r === 'admin' || r === 'seller')) return null;
  return <div role="status" className="flex items-center justify-center gap-2 border-b border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground">
    <Lock size={14} className="shrink-0 text-primary" />
    <span>사전 오픈 준비 중입니다. 현재는 관리자와 승인된 셀러만 상품을 볼 수 있습니다.</span>
  </div>;
}
