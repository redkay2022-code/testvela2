export const TOP_WATCH_BRANDS = ['ROLEX', 'PATEK PHILIPPE', 'AUDEMARS PIGUET', 'CARTIER', 'RICHARD MILLE', 'OMEGA', 'IWC', 'PANERAI', 'HUBLOT'] as const;
export const ALL_WATCH_BRANDS: readonly string[] = [
  'A. Lange & Söhne', 'Alpina', 'Angelus', 'Armin Strom', 'Arnold & Son', 'AUDEMARS PIGUET',
  'Baume & Mercier', 'Bell & Ross', 'Blancpain', 'Bovet', 'Breguet', 'Breitling', 'Bulgari',
  'Carl F. Bucherer', 'CARTIER', 'Chopard', 'Chronoswiss', 'Corum', 'Czapek', 'De Bethune',
  'Doxa', 'Eberhard & Co.', 'F.P. Journe', 'Favre-Leuba', 'Fortis', 'Franck Muller',
  'Frederique Constant', 'Girard-Perregaux', 'Glashütte Original', 'Grand Seiko', 'Greubel Forsey',
  'Hamilton', 'H. Moser & Cie.', 'Harry Winston', 'Hermès', 'HUBLOT', 'HYT', 'IWC', 'Jacob & Co.',
  'Jaeger-LeCoultre', 'Jaquet Droz', 'Laurent Ferrier', 'Longines', 'Louis Moinet', 'Louis Vuitton',
  'Maurice Lacroix', 'MB&F', 'Montblanc', 'NOMOS Glashütte', 'OMEGA', 'Oris', 'PANERAI',
  'Parmigiani Fleurier', 'PATEK PHILIPPE', 'Perrelet', 'Piaget', 'Rado', 'Ressence', 'RICHARD MILLE',
  'Roger Dubuis', 'ROLEX', 'Seiko', 'Sinn', 'TAG Heuer', 'Tissot', 'Tudor', 'Ulysse Nardin',
  'Union Glashütte', 'Urwerk', 'Vacheron Constantin', 'Van Cleef & Arpels', 'Vulcain', 'Zenith',
].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', ignorePunctuation: true }));
export function knownWatchBrand(value: string): string | undefined {
  return ALL_WATCH_BRANDS.find(brand => brand.toLocaleLowerCase('en') === value.toLocaleLowerCase('en'));
}
