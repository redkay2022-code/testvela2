import { describe, expect, it } from 'vitest';
import { watchStoryOptions, watchStorySpecs } from '@/lib/watch-story';
import { matchesFeedCategory } from '@/lib/feed-categories';
import { emptyValues, validateItem } from '@/lib/bulk-upload';
describe('Watch Story tags', () => {
  it('requires and saves the same tag in bulk uploads', () => {
    const item = { id: 'test', name: 'story.mp4', video: new File(['video'], 'story.mp4', { type: 'video/mp4' }), photos: [], values: { ...emptyValues(), title: 'Story test', menuCategory: '스토리', sell: '아니오' } };
    expect(validateItem(item, new Set()).plan).toBeNull();
    const tagged = { ...item, values: { ...item.values, storySubcategory: 'New Release Review' } };
    expect(validateItem(tagged, new Set()).plan?.specs.storySubcategory).toBe('New Release Review');
  });
  it('offers exactly the six requested tags', () => {
    expect(watchStoryOptions.map(option => option[1])).toEqual(['Watch Story', 'Make Process', 'Daily Watch', 'Repair & Care', 'Genuine vs Custom', 'New Release Review']);
  });
  it('requires a valid subcategory for Watch Story', () => {
    expect(() => watchStorySpecs('스토리', '')).toThrow();
    expect(() => watchStorySpecs('Watch Story', 'Other')).toThrow();
    expect(watchStorySpecs('스토리', 'Repair & Care')).toEqual({ storySubcategory: 'Repair & Care' });
    expect(watchStorySpecs('시계', 'Repair & Care')).toEqual({});
  });
  it('filters the saved tag rather than title keywords', () => {
    const post = { title: 'Daily Watch', description: '', category: '시계', factory: '', sample: false, menuCategory: '스토리', source: { specs: watchStorySpecs('스토리', 'Make Process') } };
    expect(matchesFeedCategory(post, 'story:make-process')).toBe(true);
    expect(matchesFeedCategory(post, 'story:daily-watch')).toBe(false);
    expect(matchesFeedCategory(post, 'story')).toBe(true);
    expect(matchesFeedCategory({ ...post, source: { specs: {} } }, 'story:watch-story')).toBe(false);
    expect(matchesFeedCategory({ ...post, menuCategory: '시계' }, 'story:make-process')).toBe(false);
  });
});