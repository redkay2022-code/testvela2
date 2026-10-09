import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShippingFields } from './shipping-fields';
import { shippingError, type ShippingInput } from '@/lib/shipping';
import { emptyShipping, useSavedShipping } from '@/lib/use-saved-shipping';
import './checkout.css';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Button } from './ui/button';
import { NicknameEditor } from './seller-account';
import { marketSearch } from '@/lib/market';

export function ProfileSettings({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const search = marketSearch.parse(useRouterState({ select: s => s.location.search }));
  const tab = search.profileTab ?? 'profile';
  return <div className="mt-5">
    <nav className="flex gap-2 border-b border-border pb-3" aria-label="프로필 편집 항목">
      {(['profile', 'shipping'] as const).map(value => <Button key={value} variant={tab === value ? 'goldOutline' : 'ghost'} aria-pressed={tab === value} onClick={() => void navigate({ to: '.', search: prev => ({ ...prev, panel: 'settings', profileTab: value }), resetScroll: false })}>{value === 'profile' ? '내 프로필' : '배송지 정보'}</Button>)}
    </nav>
    {tab === 'profile' ? user ? <NicknameEditor user={user} unframed/> : <div className="py-6"><p className="text-sm text-muted-foreground">로그인하면 프로필을 편집할 수 있습니다.</p><Button variant="goldOutline" className="mt-4" onClick={() => void navigate({ to: '.', search: prev => ({ ...prev, panel: undefined, auth: true }) })}>로그인</Button></div> :
      user ? <ShippingEditor done={() => void navigate({ to: '.', search: prev => ({ ...prev, panel: undefined, profileTab: undefined }), resetScroll: false })}/> : <p className="py-6 text-sm text-muted-foreground">로그인하면 배송지를 저장할 수 있습니다.</p>}
  </div>;
}

function ShippingEditor({ done }: { done: () => void }) {
  const ship = useSavedShipping();
  const [f, setF] = useState<ShippingInput>(emptyShipping), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { if (ship.saved) setF(ship.saved); }, [ship.saved]);
  if (ship.loading) return <p className="py-6 text-sm text-muted-foreground">불러오는 중…</p>;
  return <form className="checkout-form py-4" onSubmit={async e => {
    e.preventDefault(); const bad = shippingError(f); setErr(bad); if (bad) return;
    setBusy(true); try { await ship.save(f); toast.success('배송지를 저장했습니다.'); done(); } catch { toast.error('저장하지 못했습니다. 다시 시도해 주세요.'); } finally { setBusy(false); }
  }}>
    <p className="text-xs text-muted-foreground">저장한 배송지는 다음 주문 시 자동으로 불러오며, 결제 화면에서도 수정할 수 있습니다.</p>
    <ShippingFields value={f} onChange={setF} idPrefix="profile"/>
    {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
    <Button variant="gold" className="w-full" type="submit" disabled={busy}>배송지 저장</Button>
  </form>;
}