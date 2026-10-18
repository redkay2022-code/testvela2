import { describe, expect, it } from 'vitest';
import { avatarKey, defaultAvatarSvg, defaultAvatarUrl } from '@/lib/default-avatar';

describe('default avatar', () => {
  it('is stable for the same member and differs between members', () => {
    expect(defaultAvatarSvg(avatarKey('user-1'), '민수')).toBe(defaultAvatarSvg(avatarKey('user-1'), '민수'));
    expect(defaultAvatarSvg(avatarKey('user-1'), '민수')).not.toBe(defaultAvatarSvg(avatarKey('user-2'), '민수'));
  });
  it('uses the nickname initial and escapes markup', () => {
    expect(defaultAvatarSvg('k', 'alice')).toContain('>A</text>');
    expect(defaultAvatarSvg('k', '<b>')).not.toContain('<b>');
    expect(defaultAvatarSvg('k', '')).toContain('>V</text>');
  });
  it('builds a data url and never reveals the raw id', () => {
    expect(defaultAvatarUrl(avatarKey('abc'), 'x').startsWith('data:image/svg+xml')).toBe(true);
    expect(avatarKey('0b8a7c2e-1111-4222-8333-444455556666')).toMatch(/^[0-9a-f]{8}$/);
  });
});
