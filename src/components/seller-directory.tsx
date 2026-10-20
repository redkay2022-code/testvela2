import { Link } from '@tanstack/react-router';
import { avatarKey, defaultAvatarUrl } from '@/lib/default-avatar';
import { ArrowRight, Check, Plus, Star, Store, UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { loadSellerAvatar } from '@/lib/seller-avatar';
import { supabase } from '@/integrations/supabase/client';
import { compactCount, useSellerStats } from '@/lib/use-seller-stats';
import { Button } from './ui/button';
import { SellerBadge } from './reputation';
import { useMarketPreview } from './market-preview';
import { directorySellers, matchesStoreCategory, storeFilters, type StoreCategory } from '@/lib/seller-directory';
import { cardImageOf } from '@/lib/luxury-market';
import type { LuxuryPost } from '@/lib/luxury-market';
import { postMediaRoute } from '@/lib/post-media';
import { TranslatableText } from './translatable-text';
import { TEST_COUNTS_ENABLED } from '@/lib/test-counts';

/** 셀러가 직접 등록한 프로필 사진(스토어 아바타 → 프로필 사진). 상품 사진은 절대 대신 쓰지 않는다. */
function DirectoryAvatar({ post }: { post: LuxuryPost }) {
  const storeId = post.source.store_id ?? undefined, userId = post.source.user_id ?? undefined;
  const avatar = useQuery({ queryKey: ['seller-header-avatar', storeId ?? userId ?? null], enabled: !post.sample && Boolean(storeId || userId), queryFn: () => loadSellerAvatar({ data: { storeId, userId } }), staleTime: 300_000 });
  const shown = avatar.data?.avatar ?? (avatar.isLoading ? null : defaultAvatarUrl(avatarKey(post.source.user_id ?? post.source.store_id ?? post.creator), post.creator));
  if (shown) return <img src={shown} width={48} height={48} alt={post.creator} className="size-12 rounded-full object-cover"/>;
  return <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" role="img" aria-label={post.creator}><UserRound size={22}/></span>;
}

export function SellerDirectory({posts, category='all', role}: {posts:LuxuryPost[]; category?:StoreCategory|undefined; role?:'buyer'|'seller'|'admin'|undefined}) {
  const preview = useMarketPreview();
  const sellers = directorySellers(posts).filter(seller => matchesStoreCategory(seller, category)).sort((a,b)=>Number(Boolean(b.post.storeFeatured))-Number(Boolean(a.post.storeFeatured)) || (category==='top'?(b.rating ?? 0)-(a.rating ?? 0):0));
  /* 스토어 카드의 소개글은 셀러가 프로필에 쓴 "스토어 소개"를 그대로 보여 준다(없으면 기존 문구). */
  const stats = useSellerStats();
  const introIds = [...new Set(sellers.map(s => s.post.sample ? null : s.post.source.user_id).filter((x): x is string => Boolean(x)))].sort();
  const intros = useQuery({ queryKey: ['directory-intros', introIds.join(',')], enabled: introIds.length > 0, staleTime: 60_000, queryFn: async () => { const { data, error } = await supabase.from('seller_store_content').select('user_id,introduction').in('user_id', introIds); if (error) throw error; return new Map((data ?? []).map(r => [r.user_id, r.introduction])); } });
  return <section className="seller-directory">
    <div className="section-heading"><h1>셀러 스토어</h1><span>{sellers.length} studios</span></div>
    <nav className="directory-filters" aria-label="Seller categories">{storeFilters.map(([id,label])=><Button asChild variant="ghost" className={`lux-chip ${category===id?'active':''}`} key={id}><Link to="/store" search={{role,storeCategory:id}} resetScroll={false} aria-current={category===id?'page':undefined}>{label}</Link></Button>)}</nav>
    <div className="directory-grid">{sellers.map(seller=>{
      const following = preview.isFollowing(seller.id);
      return <article className="directory-card" key={seller.id}>
        <div className="directory-identity" data-no-translate><DirectoryAvatar post={seller.post}/><div><h2>{seller.post.creator}</h2><SellerBadge reputation={seller.post.reputation}/></div></div>
        <TranslatableText as="p" className="directory-bio" text={(seller.post.sample ? '' : intros.data?.get(seller.post.source.user_id ?? '')?.trim()) || seller.bio} />
        
        <div className="directory-metrics"><span><Star size={13}/><strong>{seller.rating?.toFixed(2) ?? '—'}</strong> Rating</span><span><strong>{seller.reviews ?? '—'}</strong> Reviews</span><span><strong>{(()=>{const s=stats.data?.get(seller.id);return s?compactCount(s.followers+(TEST_COUNTS_ENABLED?0:following?1:0)):seller.followers===null?'—':compactCount(seller.followers+(TEST_COUNTS_ENABLED?0:following?1:0));})()}</strong> Followers</span><span><strong>{stats.data?.get(seller.id)?compactCount(stats.data.get(seller.id)!.likes):'—'}</strong> Likes</span><span><strong>{stats.data?.get(seller.id)?compactCount(stats.data.get(seller.id)!.saves):'—'}</strong> Saves</span></div>
        <div className="directory-previews" aria-label={`${seller.post.creator} item previews`}>{seller.items.slice(0,4).map(item=><Link key={item.id} to={postMediaRoute(item)} params={{id:item.id}} search={{role}} aria-label={`Preview ${item.title}`}><img src={cardImageOf(item)} width={160} height={160} alt={item.title} loading="lazy" decoding="async"/></Link>)}</div>
        <div className="directory-actions"><Button variant="goldOutline" aria-pressed={following} aria-label={`${following?'Unfollow':'Follow'} ${seller.post.creator}`} onClick={()=>preview.toggleSeller(seller.id)}>{following?<Check/>:<Plus/>}{following?'Following':'Follow'}</Button><Button asChild variant="gold"><Link to="/store" search={{role,seller:seller.id}}>Visit Store<ArrowRight/></Link></Button></div>
      </article>;
    })}</div>
    {!sellers.length&&<div className="lux-empty"><Store/><h2>아직 등록된 셀러가 없습니다.</h2><Button asChild variant="goldOutline"><Link to="/store" search={{role}}>전체 셀러 보기<ArrowRight/></Link></Button></div>}
  </section>;
}