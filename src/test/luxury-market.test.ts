import { describe, expect, it } from 'vitest';
import { marketSearch } from '@/lib/market';
import { dollars,luxuryCategories,luxuryPosts } from '@/lib/luxury-market';
import type { Post } from '@/lib/market';
const sample:Post={id:'sunny-room',user_id:null,title:'Original',description:'Original',creator:'Original',category:'홈·리빙',image_key:'life-0',media_urls:[],video_url:null,video_tags:[],duration:null,price:null,box_price:null,base_likes:128,specs:{},status:'published',updated_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',store_id:null,brand:'',model:'',reference:'',subcategory:'',sku:'',currency:'USD',stock_qty:1,reserved_qty:0,low_stock_threshold:1,featured:false,data_source:'SEED',product_status:'PUBLISHED'};
describe('Luxury marketplace',()=>{
 it('validates sample roles and overlay state',()=>{expect(marketSearch.parse({role:'admin',panel:'checkout',post:'sunny-room'})).toEqual({role:'admin',panel:'checkout',post:'sunny-room'});expect(marketSearch.safeParse({role:'owner'}).success).toBe(false);});
 it('includes all requested categories',()=>{expect(luxuryCategories).toEqual(['All','News','Ready to Ship','Customizing','VS Factory','3K','APS','PPF']);});
 it('formats dollars precisely',()=>expect(dollars(480)).toBe('$480.00'));
 it('adapts editorial sample without mutating published source',()=>{const post=luxuryPosts([sample])[0];expect(post?.price).toBe(480);expect(post?.sample).toBe(true);expect(sample.title).toBe('Original');});
 it('preserves owner content',()=>{const post=luxuryPosts([{...sample,id:'owner-content',title:'My watch',media_urls:['/local-owner-photo.webp'],price:125}])[0];expect(post?.title).toBe('My watch');expect(post?.images).toEqual(['/local-owner-photo.webp']);expect(post?.verified).toBe(false);});
});
