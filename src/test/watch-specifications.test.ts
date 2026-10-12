import { describe, expect, it } from 'vitest';
import { cleanWatchSpecs, numericSpecValue, watchSpecificationFields } from '@/lib/watch-specifications';

describe('watch specification values', () => {
  it('reads numeric values from stored mm, g and Hours specifications', () => {
    expect(numericSpecValue('40 mm')).toBe('40');
    expect(numericSpecValue('12.5mm')).toBe('12.5');
    expect(numericSpecValue('155 g')).toBe('155');
    expect(numericSpecValue('72 Hours')).toBe('72');
  });
  it('retains multi-line additional details and existing specification keys on save', () => {
    const details = `${'Custom dial detail. '.repeat(10)}\nWarranty included.`;
    expect(cleanWatchSpecs({ additionalDetails: details, thickness: '12.5 mm', factory: 'Original source', empty: '' }))
      .toEqual({ additionalDetails: details, thickness: '12.5 mm', factory: 'Original source' });
  });
  it('offers all eleven requested structured specification fields', () => {
    expect(watchSpecificationFields.map(field => field.key)).toEqual(['brand', 'model', 'material', 'movement', 'caseSize', 'thickness', 'weight', 'powerReserve', 'glass', 'waterResistance', 'additionalDetails']);
  });
});