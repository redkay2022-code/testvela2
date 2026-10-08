import { Link } from '@tanstack/react-router';
import { ArrowRight, Check, Plus, Star, Store } from 'lucide-react';
import { Button } from './ui/button';
import { SellerBadge } from './reputation';
import { useMarketPreview } from './market-preview';
import { directorySellers, matchesStoreCategory, storeFilters, type StoreCategory } from '@/lib/seller-directory';
import type { LuxuryPost } from '@/lib/luxury-market';

export function SellerDirectory({posts, category='all', role}: {posts:LuxuryPost[]; category?:StoreCategory|undefined; role?:'buyer'|'seller'|'admin'|undefined}) {
  const preview = useMarketPreview();
  const sellers = directorySellers(posts).filter(seller => matchesStoreCategory(seller, category)).sort((a,b)=>Number(Boolean(b.post.storeFeatured))-Number(Boolean(a.post.storeFeatured)) || (category==='top'?(b.rating ?? 0)-(a.rating ?? 0):0));
  return <section className="seller-directory">
    <div className="section-heading"><h1>셀러 스토어</h1><span>{sellers.length} studios</span></div>
    <nav className="directory-filters" aria-label="Seller categories">{storeFilters.map(([id,label])=><Button asChild variant="ghost" className={`lux-chip ${category===id?'active':''}`} key={id}><Link to="/store" search={{role,storeCategory:id}} resetScroll={false} aria-current={category===id?'page':undefined}>{label}</Link></Button>)}</nav>
    <div className="directory-grid">{sellers.map(seller=>{
      const following = preview.isFollowing(seller.id);
      return <article className="directory-card" key={seller.id}>
        <div className="directory-identity" data-no-translate><img src={seller.post.images[0]} width={48} height={48} alt={seller.post.creator}/><div><h2>{seller.post.creator}</h2><SellerBadge reputation={seller.post.reputation}/></div></div>
        <p className="directory-bio">{seller.bio}</p>
        
        <div className="directory-metrics"><span><Star size={13}/><strong>{seller.rating?.toFixed(2) ?? '—'}</strong> Rating</span><span><strong>{seller.reviews ?? '—'}</strong> Reviews</span><span><strong>{seller.followers===null?'—':new Intl.NumberFormat('en',{notation:'compact'}).format(seller.followers+(following?1:0))}</strong> Followers</span></div>
        <div className="directory-previews" aria-label={`${seller.post.creator} item previews`}>{seller.items.slice(0,4).map(item=><Link key={item.id} to={item.short?'/shorts/$id':'/post/$id'} params={{id:item.id}} search={{role}} aria-label={`Preview ${item.title}`}><img src={item.images[0]} width={160} height={160} alt={item.title} loading="lazy"/></Link>)}</div>
        <div className="directory-actions"><Button variant="goldOutline" aria-pressed={following} aria-label={`${following?'Unfollow':'Follow'} ${seller.post.creator}`} onClick={()=>preview.toggleSeller(seller.id)}>{following?<Check/>:<Plus/>}{following?'Following':'Follow'}</Button><Button asChild variant="gold"><Link to="/store" search={{role,seller:seller.id}}>Visit Store<ArrowRight/></Link></Button></div>
      </article>;
    })}</div>
    {!sellers.length&&<div className="lux-empty"><Store/><h2>아직 등록된 셀러가 없습니다.</h2><Button asChild variant="goldOutline"><Link to="/store" search={{role}}>전체 셀러 보기<ArrowRight/></Link></Button></div>}
  </section>;
}