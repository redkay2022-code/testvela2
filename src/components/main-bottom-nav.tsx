import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Home, MessageCircle, Plus, ShoppingBag, Store, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { accountPage, accountUploadRole } from '@/lib/seller-approval';
import { Button } from './ui/button';
import { Tx } from './tx';
import { useMarketPreview } from './market-preview';
import { useMyAccount } from './seller-account';
import { useNotifications } from './notification-bell';

/**
 * 메인 페이지와 같은 하단 메뉴(메인 페이지 · 스토어 · 장바구니/올리기 · 메시지 · 나).
 * 결제 화면, 공동구매 초대 화면처럼 메인 화면 밖의 페이지에서도 똑같이 보이도록 따로 만들었다.
 * 스타일(.lux-bottom-nav)은 메인 화면과 같은 것을 쓴다.
 */
export function MainBottomNav() {
  const navigate = useNavigate();
  const preview = useMarketPreview();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setUser(s?.user ?? null); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  const account = useMyAccount(user);
  const notifications = useNotifications(user);
  const uploadRole = accountUploadRole(user ? account.data : undefined);
  const myPage = accountPage(user ? account.data : undefined);
  const sellerNavigation = myPage === '/seller';
  const guest = ready && !user;
  const guardGuest = (e: React.MouseEvent) => { if (!guest) return; e.preventDefault(); void navigate({ to: '/', search: { auth: true } }); };
  return <nav className="lux-bottom-nav notranslate" translate="no" aria-label="Main navigation"><div>
    <Button asChild variant="ghost" className="lux-nav-item"><Link to="/" aria-label={sellerNavigation ? '홈' : '메인 페이지'}><Home aria-hidden="true" /><span><Tx>{sellerNavigation ? '홈' : '메인 페이지'}</Tx></span></Link></Button>
    <Button asChild variant="ghost" className="lux-nav-item"><Link to={sellerNavigation ? '/seller-store' : '/store'} aria-label={sellerNavigation ? '스토어 관리' : '스토어'} onClick={guardGuest}><Store aria-hidden="true" /><span><Tx>{sellerNavigation ? '스토어 관리' : '스토어'}</Tx></span></Link></Button>
    {uploadRole
      ? <Button asChild variant="gold" className="lux-upload"><Link to="/upload" search={{ role: uploadRole }} aria-label="상품 올리기"><Plus aria-hidden="true" /><span className="sr-only"><Tx>상품 올리기</Tx></span></Link></Button>
      : <Button asChild variant="gold" className="lux-upload lux-buyer-bag"><Link to="/me" search={{ panel: 'cart' }} aria-label={preview.cart.length ? `장바구니 (${preview.cart.length}개)` : '장바구니'} onClick={guardGuest}><ShoppingBag aria-hidden="true" /><span className="sr-only"><Tx>장바구니</Tx></span>{preview.cart.length > 0 && <span className="bag-count" aria-hidden="true">{preview.cart.length}</span>}</Link></Button>}
    {sellerNavigation
      ? <Button asChild variant="ghost" className="lux-nav-item"><Link to="/seller-messages" search={{ role: 'seller' }} aria-label="메시지함"><span className="relative"><MessageCircle aria-hidden="true" />{notifications.unread > 0 && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-destructive" />}</span><span><Tx>메시지함</Tx></span></Link></Button>
      : <Button variant="ghost" className="lux-nav-item" aria-label="메시지" onClick={() => { if (guest) { void navigate({ to: '/', search: { auth: true } }); return; } toast('서비스 준비 중입니다.'); }}><MessageCircle aria-hidden="true" /><span><Tx>메시지</Tx></span></Button>}
    {sellerNavigation && user
      ? <Button asChild variant="ghost" className="lux-nav-item"><Link to="/s/$slug" params={{ slug: user.id }} search={{ role: 'seller' }} aria-label="내 스튜디오" onClick={guardGuest}><UserIcon aria-hidden="true" /><span><Tx>내 스튜디오</Tx></span></Link></Button>
      : <Button asChild variant="ghost" className="lux-nav-item"><Link to={sellerNavigation ? '/seller' : myPage} search={(myPage === '/admin' ? { role: 'admin' } : {}) as never} aria-label={sellerNavigation ? '내 스튜디오' : '나'} onClick={guardGuest}><UserIcon aria-hidden="true" /><span><Tx>{sellerNavigation ? '내 스튜디오' : '나'}</Tx></span></Link></Button>}
  </div></nav>;
}
