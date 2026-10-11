import { describe, expect, it } from 'vitest';
import { validatePostTitle } from '@/lib/post-title';

describe('post title rule', () => {
  it('rejects an empty title', () => expect(validatePostTitle('   ')).not.toBeNull());
  it('rejects a 1-character title', () => expect(validatePostTitle(' 시 ')).not.toBeNull());
  it('accepts a 2-character title', () => expect(validatePostTitle('시계')).toBeNull());
});
