import { useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import { AlertTriangle, BadgeCheck, Bell, Film, MessageCircle, Package, Pencil, Plus, Truck, Wallet } from 'lucide-react';
import { Button } from './ui/button';
import { useMyAccount } from './seller-account';
import { SellerListings } from './seller-listings';
import { LiveOrderBoard } from './live-orders';
import { NotificationList, useSharedNotifications } from './notification-bell';
import { StudioTierBadge, StudioTierPanel } from './reputation';
import { useAvatarUrl } from '@/lib/avatar';
import { useStudioReputation } from '@/lib/studio-tier';
import { ratingAverage, ratingDowngradeAlert, sellerTier, studioNames } from '@/lib/reputation';
import { marketSearch } from '@/lib/market';
import { formatMoney } from '@/lib/currency';

const tabs = [['tier', 'Studio Tier', BadgeCheck], ['orders', '주문', Package], ['feed', '내 피드', Film], ['inbox', '메시지함', MessageCircle]] as const;

export function SellerStudio({ user }: { user: User }) {
  const search = marketSearch.parse(useRouterState({ select: s => s.location.search }));
  const account = useMyAccount(user);
  const avatar = useAvatarUrl(account.data?.profile?.avatar_url);
  const performance = useStudioReputation(account.data?.roles.includes('seller') ? user.id : null);
  const notifications = useSharedNotifications();
  const section = search.section === 'products' || search.section === 'inventory' ? 'feed' : tabs.some(([id]) => id === search.section) ? search.section : 'tier';
  const reputation = performance.data?.reputation;
  const tier = reputation ? sellerTier(reputation) ?? 'standard' : 'standard';
  const average = reputation ? ratingAverage(reputation) : null;
  const alert = reputation ? ratingDowngradeAlert(reputation) : null;
  useEffect(() => { if (section === 'inbox' && notifications?.unread) void notifications.markRead(); }, [section, notifications?.unread]);

  return <div className="seller-studio" lang="ko">
    <header>
      <div className="studio-title-row"><div><span className="lux-eyebrow" data-no-translate>VELAMARKET / SELLER</span><h1>내 스튜디오</h1></div><Button asChild variant="ghost" size="icon" aria-label="프로필 편집"><Link to="/seller" search={prev => ({ ...prev, panel: 'settings' })} resetScroll={false}><Pencil/></Link></Button></div>
      <div className="studio-identity"><div className="studio-avatar">{avatar ? <img src={avatar} alt="스튜디오 프로필"/> : <span data-no-translate>V</span>}</div><div className="min-w-0"><div className="studio-name-line"><h2 data-no-translate>{account.data?.profile?.nickname ?? 'VELA Studio'}</h2><StudioTierBadge tier={tier}/></div><p className="studio-system-id" data-no-translate>#{account.data?.profile?.system_code ?? '—'}</p><span className="studio-account-label"><BadgeCheck size={13}/>승인된 셀러</span></div></div>
      <dl className="studio-profile-stats"><div><dt>누적 매출 ($)</dt><dd data-no-translate>{reputation ? formatMoney(reputation.volumeUsd ?? 0, 'USD') : '—'}</dd></div><div><dt>평균 평점</dt><dd data-no-translate><span className="text-primary">★</span> {average === null ? '—' : average.toFixed(2)}</dd></div><div><dt>전체 리뷰</dt><dd data-no-translate>{performance.data ? performance.data.stats.count.toLocaleString() : '—'}<small>개</small></dd></div></dl>
    </header>
    <div className="studio-quick-actions" aria-label="스튜디오 빠른 작업">
      <Button asChild variant="gold"><Link to="/upload" search={{ role: 'seller' }}><Plus/><span>상품 등록</span></Link></Button>
      <Button asChild variant="goldOutline"><Link to="/seller" search={prev => ({ ...prev, panel: 'wallet' })} resetScroll={false}><Wallet/><span>암호화폐 지갑<small>에스크로</small></span></Link></Button>
      <Button asChild variant="goldOutline"><Link to="/seller" search={{ role: 'seller', section: 'orders' }} resetScroll={false}><Truck/><span>물류·배송</span></Link></Button>
    </div>
    {alert && <div role="alert" className="studio-rating-alert"><AlertTriangle size={18}/><p>평점 {alert.average.toFixed(2)}점 · {studioNames[alert.tier]} 기준 {alert.required.toFixed(1)}점 미달로 {studioNames[alert.fallback]} 적용 중</p></div>}
    <nav className="studio-content-tabs" aria-label="스튜디오 메뉴">{tabs.map(([id, label, Icon]) => <Button asChild variant="ghost" key={id} className={section === id ? 'active' : ''}><Link to="/seller" search={{ role: 'seller', section: id }} resetScroll={false} aria-current={section === id ? 'page' : undefined}><Icon/><span>{label}</span>{id === 'inbox' && !!notifications?.unread && <span className="studio-unread">{notifications.unread}</span>}</Link></Button>)}</nav>
    <section className="studio-content" aria-label={tabs.find(([id]) => id === section)?.[1]}>
      {section === 'feed' ? <SellerListings/> : section === 'orders' ? <><div className="studio-section-heading"><Truck/><h2>주문 · 물류·배송</h2></div><p className="studio-qc-notice"><AlertTriangle size={16}/>출고 전 QC 필수 · 사진 9장 + 영상 1개</p><LiveOrderBoard as="seller"/></> : section === 'inbox' ? <><div className="studio-section-heading"><Bell/><h2>알림 및 정책 안내</h2></div>{notifications && <NotificationList notifications={notifications}/>}<div className="studio-section-heading mt-7"><MessageCircle/><h2>고객 상담 · 주문 메시지</h2></div><LiveOrderBoard as="seller"/></> : <>{performance.isError ? <div className="lux-empty"><p>스튜디오 실적을 불러오지 못했습니다.</p><Button variant="goldOutline" onClick={() => void performance.refetch()}>다시 시도</Button></div> : reputation ? <StudioTierPanel reputation={reputation} live stats={performance.data?.stats} recent={performance.data?.recent}/> : <p className="py-8 text-center text-sm text-muted-foreground">실적을 불러오는 중…</p>}</>}
    </section>
  </div>;
}