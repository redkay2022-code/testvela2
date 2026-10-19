import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostCategoryField } from '@/components/post-category-field';
import { emptyValues, validateItem } from '@/lib/bulk-upload';
import { setActiveLang } from '@/lib/i18n';
import { watchStoryOptions } from '@/lib/watch-story';

vi.mock('@/components/currency', () => ({ useCurrency: () => ({ lang: 'en' }) }));
vi.mock('@/lib/dom-translate', () => ({ tx: (s: string) => s }));
vi.mock('@/components/tx', () => ({ Tx: ({ children }: { children: string }) => children }));

afterEach(() => { cleanup(); setActiveLang('en'); });

function Form() {
  const [category, setCategory] = useState('스토리');
  const [tag, setTag] = useState('');
  const [title, setTitle] = useState('Custom title');
  return <>
    <PostCategoryField value={category} onChange={setCategory} subcategory={tag} onSubcategoryChange={setTag} onTitleChange={setTitle} />
    <input aria-label="Title" value={title} onChange={e => setTitle(e.target.value)} />
  </>;
}

describe('Story title selection', () => {
  for (const [, option] of watchStoryOptions) {
    it(`sets ${option} as the English title and saved tag`, () => {
      setActiveLang('ko');
      render(<Form />);
      fireEvent.change(screen.getByLabelText(/스토리 세부 분류/), { target: { value: option } });
      expect(screen.getByLabelText('Title')).toHaveValue(option);
      const item = { id: 'story', name: 'story.mp4', video: new File(['video'], 'story.mp4', { type: 'video/mp4' }), photos: [], values: { ...emptyValues(), menuCategory: 'Story', storySubcategory: option, title: option, sell: '아니오' } };
      const plan = validateItem(item, new Set()).plan;
      expect(plan?.title).toBe(option);
      expect(plan?.specs['storySubcategory']).toBe(option);
      expect(plan?.specs['menuCategory']).toBe('스토리');
    });
  }
  it('allows editing the default title and replaces it on the next selection', () => {
    render(<Form />);
    const select = screen.getByLabelText(/Story sub-category/);
    fireEvent.change(select, { target: { value: 'Daily Style' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My bag today' } });
    expect(screen.getByLabelText('Title')).toHaveValue('My bag today');
    fireEvent.change(select, { target: { value: 'Repair & Care' } });
    expect(screen.getByLabelText('Title')).toHaveValue('Repair & Care');
  });
});