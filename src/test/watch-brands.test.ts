import { describe, expect, it } from 'vitest';
import { ALL_WATCH_BRANDS, TOP_WATCH_BRANDS, knownWatchBrand } from '@/lib/watch-brands';
describe('watch brand catalog', () => {
  it('preserves the requested top nine order', () => {
    expect([...TOP_WATCH_BRANDS]).toEqual(['ROLEX', 'PATEK PHILIPPE', 'AUDEMARS PIGUET', 'CARTIER', 'RICHARD MILLE', 'OMEGA', 'IWC', 'PANERAI', 'HUBLOT']);
  });
  it('keeps the full catalog unique and alphabetically sorted', () => {
    expect(new Set(ALL_WATCH_BRANDS).size).toBe(ALL_WATCH_BRANDS.length);
    expect([...ALL_WATCH_BRANDS]).toEqual([...ALL_WATCH_BRANDS].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', ignorePunctuation: true })));
    for (const brand of ['A. Lange & Söhne', 'Blancpain', 'Breguet', 'Breitling', 'Chopard', 'F.P. Journe', 'Grand Seiko', 'Jaeger-LeCoultre', 'Longines', 'Tudor', 'Vacheron Constantin', 'Zenith', ...TOP_WATCH_BRANDS]) expect(ALL_WATCH_BRANDS).toContain(brand);
  });
  it('recognizes legacy casing and allows arbitrary custom brands', () => {
    expect(knownWatchBrand('Rolex')).toBe('ROLEX');
    expect(knownWatchBrand('My custom atelier')).toBeUndefined();
  });
});
