import { Heart, ShoppingBag, X, ArrowRight, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { useMarketPreview } from './market-preview';
import { dollars, type LuxuryPost } from '@/lib/luxury-market';

export function ShoppingCollection({posts,onBuy}:{posts:LuxuryPost[];onBuy:(post:LuxuryPost)=>void}) {
  const preview=useMarketPreview();
  const saved=posts.filter(post=>preview.saved.includes(post.id));
  return <><p className="sample-notice">Sample shopping bag · No payment taken</p>
    <div className="section-heading mt-5"><h2>장바구니</h2><span>{preview.cart.length} items</span></div>
    {preview.cart.length?preview.cart.map(post=><div className="shopping-row" key={post.id}><img src={post.images[0]} width={64} height={64} alt={post.title}/><div><h3>{post.title}</h3><p className="text-primary">{dollars(post.price ?? 0)}</p><Button variant="link" onClick={()=>onBuy(post)}>Review order<ArrowRight/></Button></div><Button variant="ghost" size="icon" aria-label={`Remove ${post.title}`} onClick={()=>preview.removeCart(post.id)}><X/></Button></div>):<div className="shopping-empty"><ShoppingBag/><p>Your bag is empty.</p></div>}
    {preview.cart.length>0&&<p className="shopping-total">Total {dollars(preview.cart.reduce((sum,post)=>sum+(post.price ?? 0),0))}</p>}
    <div className="section-heading mt-7"><h2>Saved items</h2><span>{saved.length} items</span></div>
    {saved.length?saved.map(post=><div className="shopping-row" key={post.id}><img src={post.images[0]} width={64} height={64} alt={post.title}/><div><h3>{post.title}</h3><p className="text-primary">{dollars(post.price ?? 0)}</p><Button variant="link" disabled={preview.cart.some(item=>item.id===post.id)} onClick={()=>preview.addCart(post)}><Plus/>{preview.cart.some(item=>item.id===post.id)?'In your bag':'Add to Cart'}</Button></div><Button variant="ghost" size="icon" aria-label={`Unsave ${post.title}`} onClick={()=>preview.toggleSaved(post.id)}><Heart fill="currentColor"/></Button></div>):<div className="shopping-empty"><Heart/><p>No saved items yet.</p></div>}
  </>;
}