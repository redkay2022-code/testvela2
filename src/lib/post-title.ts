/** Post titles are required and must contain at least 2 visible characters. Returns an error message or null. */
export function validatePostTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return '제목을 입력해 주세요.';
  if ([...t].length < 2) return '제목은 2자 이상 입력해 주세요.';
  return null;
}
