import { describe, expect, it } from 'vitest';
import { detailMedia, isHybridPost, postMediaRoute, postPhotos } from '@/lib/post-media';
import { luxuryPosts } from '@/lib/luxury-market';
import type { Post } from '@/lib/market';

const source: Post = {
 id:'media-routing', user_id:null, title:'Watch', description:'Watch details', creator:'Studio', category:'시계', image_key:'uploaded',
 media_urls:[], video_url:null, thumbnail_url:'/poster.jpg', music_track_id:null, music_title:null, music_artist:null, music_audio_url:null, music_license_url:null,
 video_tags:[], duration:null, price:100, box_price:null, base_likes:0, specs:{}, status:'published', updated_at:'2026-10-08T00:00:00Z', created_at:'2026-10-08T00:00:00Z',
 store_id:null, brand:'', model:'', reference:'', subcategory:'', sku:'', currency:'USD', stock_qty:1, reserved_qty:0, low_stock_threshold:1, featured:false, data_source:'USER', product_status:'PUBLISHED',
};
function post(fields: Partial<Post>) {
 const item=luxuryPosts([{...source,...fields}])[0];
 if(!item)throw new Error('Missing post');
 return item;
}
describe('Post media navigation',()=>{
 it('opens photo-only posts on the product page',()=>{
  expect(postMediaRoute(post({media_urls:['/photo.jpg']}))).toBe('/post/$id');
 });
 it('opens hybrid posts in Shorts first',()=>{
  expect(postMediaRoute(post({media_urls:['/photo.jpg'],video_url:'/video.mp4'}))).toBe('/shorts/$id');
 });
 it('opens video-only posts in Shorts without counting generated posters as photos',()=>{
  const item=post({video_url:'/video.mp4'});
  expect(item.images).toEqual(['/poster.jpg']);
  expect(postPhotos(item)).toEqual([]);
  expect(postMediaRoute(item)).toBe('/shorts/$id');
 });
 it('combines one video and uploaded photos in one ordered gallery',()=>{
  expect(detailMedia(post({video_url:'/video.mp4',media_urls:['/one.jpg','/two.jpg']}))).toEqual([
   {kind:'video',src:'/video.mp4'}, {kind:'photo',src:'/one.jpg'}, {kind:'photo',src:'/two.jpg'},
  ]);
 });
});