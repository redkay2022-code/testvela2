import { putMarketMedia } from './market-upload';
import { LONG_CACHE } from './image-compress';

/**
 * A small picture (~480 px, WebP) used for the cards in the feed, so a feed full of products downloads a fraction of
 * the data that full-size photos would need. The full photos are still used on the product page.
 * The card's storage path is kept in the product's specs (specs.cardImage). Nothing here ever throws: if the card
 * cannot be made, the product just keeps using its first full-size photo.
 */
export const CARD_EDGE = 480;

export async function makeCardImage(source: Blob, edge = CARD_EDGE, quality = 0.78): Promise<Blob | null> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return null; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    return blob && blob.type === 'image/webp' ? blob : null;
  } catch { return null; }
}

/** Makes the card picture for a photo and uploads it. Returns the storage path, or null when anything fails. */
export async function uploadCardImage(photo: Blob, folder: string): Promise<string | null> {
  const card = await makeCardImage(photo);
  if (!card) return null;
  const path = `${folder}/${crypto.randomUUID()}-card.webp`;
  const { error } = await putMarketMedia(path, card, { contentType: 'image/webp', cacheControl: LONG_CACHE });
  return error ? null : path;
}

/** The card path stored on a product, if it has one. */
export function cardPathOf(specs: unknown): string | null {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return null;
  const v = (specs as Record<string, unknown>)['cardImage'];
  return typeof v === 'string' && v ? v : null;
}
