import { describe, expect, it } from 'vitest';
import { PAGE_SIZES, pageNumbers } from '@/components/list-pagination';

describe('page numbers', () => {
  it('offers 5, 10, 15 and 20 items per page', () => expect([...PAGE_SIZES]).toEqual([5, 10, 15, 20]));
  it('shows every page when there are few', () => expect(pageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]));
  it('keeps first, last and neighbours with gaps for many pages', () => {
    expect(pageNumbers(1, 12)).toEqual([1, 2, 3, 4, 5, 'gap-end', 12]);
    expect(pageNumbers(6, 12)).toEqual([1, 'gap-start', 5, 6, 7, 'gap-end', 12]);
    expect(pageNumbers(12, 12)).toEqual([1, 'gap-start', 8, 9, 10, 11, 12]);
  });
});
