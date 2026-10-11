import { describe, expect, it } from 'vitest';
import { productEntry } from '../lib/product-entry';

describe('product selection access', () => {
  it('requires signup when a signed-out visitor selects a product', () => {
    expect(productEntry(true, false)).toBe('signup');
  });
  it('opens the product for a signed-in visitor', () => {
    expect(productEntry(true, true)).toBe('product');
  });
  it('waits for restored sessions instead of asking returning users to sign up', () => {
    expect(productEntry(false, false)).toBe('loading');
  });
});