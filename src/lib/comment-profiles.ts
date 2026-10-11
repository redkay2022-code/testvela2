export type CommentProfile = { user_id: string; nickname: string; avatar_url: string | null };

export function commentAvatarPath(profile: CommentProfile): string | null {
  const path = profile.avatar_url;
  return path && path.startsWith(`${profile.user_id}/`) && !path.includes('..') && !path.includes('://') ? path : null;
}

export function commentNickname(profile: CommentProfile | undefined): string {
  return profile?.nickname.trim() || 'VELA 회원';
}
