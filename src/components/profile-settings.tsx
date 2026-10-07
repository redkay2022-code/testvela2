import type { User } from '@supabase/supabase-js';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Button } from './ui/button';
import { NicknameEditor } from './seller-account';
import { useMarketPreview } from './market-preview';
import { marketSearch } from '@/lib/market';

export function ProfileSettings({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const search = marketSearch.parse(useRouterState({ select: s => s.location.search }));
  const tab = search.profileTab ?? 'profile';
  const preview = useMarketPreview();
  return <div className="mt-5">
    <nav className="flex gap-2 border-b border-border pb-3" aria-label="프로필 편집 항목">
      {(['profile', 'shipping'] as const).map(value => <Button key={value} variant={tab === value ? 'goldOutline' : 'ghost'} aria-pressed={tab === value} onClick={() => void navigate({ to: '.', search: prev => ({ ...prev, panel: 'settings', profileTab: value }), resetScroll: false })}>{value === 'profile' ? '내 프로필' : '배송지 정보'}</Button>)}
    </nav>
    {tab === 'profile' ? user ? <NicknameEditor user={user} unframed/> : <div className="py-6"><p className="text-sm text-muted-foreground">로그인하면 프로필을 편집할 수 있습니다.</p><Button variant="goldOutline" className="mt-4" onClick={() => void navigate({ to: '.', search: prev => ({ ...prev, panel: undefined, auth: true }) })}>로그인</Button></div> :
      <form className="py-4" onSubmit={e => {
        e.preventDefault();
        const fields = new FormData(e.currentTarget);
        const field = (name: string, max: number) => String(fields.get(name) ?? '').trim().slice(0, max);
        preview.saveProfile({ recipient: field('recipient', 60), phone: field('phone', 30), address: field('address', 300), postal: field('postal', 12), region: field('region', 200) });
        void navigate({ to: '.', search: prev => ({ ...prev, panel: undefined, profileTab: undefined }), resetScroll: false });
      }}>
        <p className="text-xs text-muted-foreground">배송지 정보는 현재 이용 중인 화면에서 구매 시 자동 입력됩니다.</p>
        <label className="form-label" htmlFor="profile-region">국가 / 지역</label><input id="profile-region" name="region" className="form-input" defaultValue={preview.profile.region}/>
        <label className="form-label" htmlFor="profile-recipient">수령인</label><input id="profile-recipient" name="recipient" className="form-input" maxLength={60} autoComplete="name" defaultValue={preview.profile.recipient}/>
        <label className="form-label" htmlFor="profile-phone">연락처</label><input id="profile-phone" name="phone" type="tel" className="form-input" maxLength={30} autoComplete="tel" defaultValue={preview.profile.phone}/>
        <label className="form-label" htmlFor="profile-address">배송 주소</label><textarea id="profile-address" name="address" className="form-input" maxLength={300} autoComplete="street-address" defaultValue={preview.profile.address}/>
        <label className="form-label" htmlFor="profile-postal">우편번호</label><input id="profile-postal" name="postal" className="form-input" maxLength={12} autoComplete="postal-code" defaultValue={preview.profile.postal}/>
        <Button variant="gold" className="mt-6 w-full" type="submit">배송지 저장</Button>
      </form>}
  </div>;
}