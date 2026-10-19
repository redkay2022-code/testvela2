export const watchStoryOptions = [
  ['make-process', 'Make Process', 'makeProcess'],
  ['daily-style', 'Daily Style', 'dailyStyle'],
  ['repair-care', 'Repair & Care', 'repairCare'],
  ['genuine-vs-custom', 'Genuine vs Custom', 'genuineVsCustom'],
  ['new-release-review', 'New Release Review', 'newReleaseReview'],
] as const;
export const isWatchStory = (category: string) => category === '스토리' || category === 'Story' || category === 'Watch Story';
export const normalizeStoryTag = (value: unknown): string => value === 'Daily Watch' ? 'Daily Style' : typeof value === 'string' ? value : '';
export const isWatchStoryTag = (value: unknown): value is string => watchStoryOptions.some(option => option[1] === value);
export function watchStorySpecs(category: string, tag: string): Record<string, string> {
  if (!isWatchStory(category)) return {};
  if (!isWatchStoryTag(tag)) throw new Error('Select a Story sub-category.');
  return { storySubcategory: tag };
}
export const storyFeedTag = (id: string) => id === 'story:daily-watch' ? 'Daily Style' : watchStoryOptions.find(option => `story:${option[0]}` === id)?.[1];