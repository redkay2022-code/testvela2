/**
 * 프로필 사진이 없는 회원에게 보여 주는 기본 아바타.
 * 회원 ID(해시)와 닉네임으로 색·무늬·이니셜을 정해 SVG로 그리므로, 같은 회원은 어디서나 같은 모양이다.
 * 이미지 파일도 외부 서비스도 필요 없다.
 */
const palettes = [
  ['#D4AF37', '#F5E7B8'], ['#B87333', '#EBC7A0'], ['#9AA3AD', '#E6EAEE'],
  ['#2F8F6B', '#A6E6C9'], ['#3B6FD1', '#B1CCFF'], ['#B8586E', '#F3BCC9'],
] as const;

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** 회원 ID를 되돌릴 수 없는 짧은 키로 바꾼다. 서버·화면 어디서 계산해도 같은 값이다. */
export function avatarKey(id: string | null | undefined): string {
  return fnv(`vela:${id ?? ''}`).toString(16).padStart(8, '0');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function defaultAvatarSvg(key: string, nickname = ''): string {
  const name = nickname.trim(), first = Array.from(name.replace(/^[#@\s]+/, ''))[0] ?? '';
  const initial = esc((first || 'V').toUpperCase());
  const h = fnv(`${key}|${name}`), [c1, c2] = palettes[h % palettes.length]!;
  const kind = (h >>> 4) % 4, rot = ((h >>> 8) % 12) * 30, step = 8 + ((h >>> 12) % 3) * 2;
  let art = '';
  if (kind === 0) for (let r = step; r < 48; r += step) art += `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${c1}" stroke-opacity=".38" stroke-width="2"/>`;
  else if (kind === 1) for (let x = -64; x < 128; x += step) art += `<rect x="${x}" y="-32" width="3" height="128" fill="${c1}" fill-opacity=".32" transform="rotate(${rot} 32 32)"/>`;
  else if (kind === 2) for (let a = 0; a < 64; a += step + 4) for (let b = 0; b < 64; b += step + 4) art += `<rect x="${a + 2}" y="${b + 2}" width="5" height="5" fill="${c1}" fill-opacity=".34" transform="rotate(45 ${a + 4.5} ${b + 4.5})"/>`;
  else for (let a = 6; a < 64; a += step + 2) for (let b = 6; b < 64; b += step + 2) art += `<circle cx="${a}" cy="${b}" r="2.2" fill="${c1}" fill-opacity=".4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101014"/><stop offset="1" stop-color="${c1}" stop-opacity=".42"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/>${art}<circle cx="32" cy="32" r="17" fill="#0D0D0F" fill-opacity=".72" stroke="${c1}" stroke-width="1.5"/><text x="32" y="32" text-anchor="middle" dominant-baseline="central" font-family="Georgia,'Times New Roman',serif" font-size="22" font-weight="700" fill="${c2}">${initial}</text></svg>`;
}

export function defaultAvatarUrl(key: string, nickname = ''): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(defaultAvatarSvg(key, nickname))}`;
}
