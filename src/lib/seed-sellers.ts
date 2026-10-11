import { watchImages, type LuxuryPost } from './luxury-market';
import { launchReputation } from './reputation';
import type { Post } from './market';
import shortMp4 from '@/assets/studio-short.mp4';
import short5Mp4 from '@/assets/studio-short-5.mp4';
import short2Mp4 from '@/assets/studio-short-2.mp4';
import studioShort from '@/assets/studio-short.webm';
import studioShort5 from '@/assets/studio-short-5.webm';
import studioShort2 from '@/assets/studio-short-2.webm';

/** Launch showcase sellers (10 watch + 3 accessory); local sample data, not Cloud accounts. */
export const seedSellers = [
  ...['Geneva Atelier','Hong Kong Time Lab','Seoul Horology','Shenzhen Precision','Milano Orologi','Tokyo Tick Works','Dubai Crown Watches','Zurich Movement Co.','Paris Cadran','Singapore Steel & Sapphire'].map(name => ({ name, kind: 'watch' as const })),
  ...['Vela Leather Straps','Royal Box & Case','Crown Winder Studio'].map(name => ({ name, kind: 'accessory' as const })),
];
const watchItems = [['Submariner 41 Black Dial','Rolex','Submariner 126610LN','3235 Automatic','41mm','300m','Oystersteel'],['Daytona Panda','Rolex','Daytona 116500LN','4130 Chronograph','40mm','100m','Oystersteel'],['Nautilus Blue','Patek Philippe','Nautilus 5711/1A','324 SC Automatic','40mm','120m','Stainless Steel'],['Royal Oak Jumbo','Audemars Piguet','Royal Oak 15202ST','2121 Automatic','39mm','50m','Stainless Steel']];
const accessoryItems = [['Alligator Leather Strap 20mm','Custom','Strap 20/18','—','20mm','—','Alligator Leather'],['Lacquered Presentation Box','Custom','Box Set','—','—','—','Wood / Lacquer'],['Dual Watch Winder','Custom','Winder Duo','Quiet Motor','—','—','Carbon / Velvet']];
const videos: [string,string][] = [[studioShort,shortMp4],[studioShort5,short5Mp4],[studioShort2,short2Mp4]];
const cats = ['커스텀제작','공장 생산','제작 과정','기타'];

export const seedPosts: LuxuryPost[] = seedSellers.flatMap((seller, s) => [0, 1].map(n => {
  const i = s * 2 + n, acc = seller.kind === 'accessory';
  const item = acc ? accessoryItems[s - 10]! : watchItems[i % watchItems.length]!;
  const [title, brand, model, movement, caseSize, waterResistance, material] = item as unknown as string[] as [string,string,string,string,string,string,string];
  const photo = watchImages[i % 6]!; const video = n === 0 ? videos[s % 3]! : null;
  const price = acc ? [90, 150, 220][s - 10]! + n * 20 : 380 + ((i * 47) % 420);
  const specs = { brand, model, movement, caseSize, waterResistance, material, glass: acc ? '—' : 'Sapphire', condition: 'New' };
  const source = { id: `seed-${i}`, user_id: null, title, description: '', creator: seller.name, category: cats[i % 4]!, image_key: '', media_urls: [], video_url: null, video_tags: [], duration: null, price, base_likes: 40 + (i * 37) % 900, created_at: new Date(Date.UTC(2026, 9, 1) - i * 3600e3).toISOString(), box_price: acc ? null : 50, status: 'published', specs, updated_at: '' } as unknown as Post;
  return { id: source.id, source, sample: true, reputation: launchReputation, title: `${brand === 'Custom' ? '' : brand + ' '}${title}`, description: `${seller.name}의 런칭 쇼케이스 상품입니다. 출고 전 상세 검수 사진을 제공합니다.`, creator: seller.name, images: [photo, watchImages[(i + 2) % 6]!, watchImages[(i + 4) % 6]!], video: video?.[0] ?? null, videoFallback: video?.[1], short: Boolean(video), price, boxPrice: source.box_price, factory: acc ? 'Accessory' : ['VS Factory','Clean','3K','APS'][i % 4]!, category: source.category, views: `${(1 + (i * 7) % 9)}.${i % 10}K`, likes: source.base_likes, verified: true };
}));
