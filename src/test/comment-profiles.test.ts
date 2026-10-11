import { describe, expect, it } from 'vitest';
import { commentAvatarPath, commentNickname } from '../lib/comment-profiles';
describe('comment profile identity', () => {
  it('uses the current nickname', () => {
    expect(commentNickname({ user_id: 'buyer', nickname: '새 닉네임', avatar_url: null })).toBe('새 닉네임');
  });
  it('uses an anonymous fallback when a profile is missing or blank', () => {
    expect(commentNickname(undefined)).toBe('VELA 회원');
    expect(commentNickname({ user_id: 'buyer', nickname: ' ', avatar_url: null })).toBe('VELA 회원');
  });
  it('permits only the author’s own avatar path', () => {
    expect(commentAvatarPath({ user_id: 'buyer', nickname: '회원', avatar_url: 'buyer/avatar.jpg' })).toBe('buyer/avatar.jpg');
    for (const path of ['other/avatar.jpg', 'buyer/../other/avatar.jpg', 'https://example.com/avatar.jpg', null]) {
      expect(commentAvatarPath({ user_id: 'buyer', nickname: '회원', avatar_url: path })).toBeNull();
    }
  });
});
