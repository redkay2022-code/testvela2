import { describe, expect, it } from 'vitest';
import { guestMayWatch, productEntry } from '../lib/product-entry';

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
describe('signed-out visitors and video listings', () => {
  it('lets a signed-out visitor watch a video listing', () => {
    expect(guestMayWatch({ video: 'https://stream.mux.com/abcdefgh12345.m3u8' })).toBe(true);
  });
  it('still asks for sign-in on listings without a video, or when nothing is selected', () => {
    expect(guestMayWatch({ video: null })).toBe(false);
    expect(guestMayWatch({})).toBe(false);
    expect(guestMayWatch(undefined)).toBe(false);
  });
});
