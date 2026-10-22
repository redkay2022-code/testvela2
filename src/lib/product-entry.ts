/** Wait for session hydration before deciding whether product access needs signup. */
export function productEntry(ready: boolean, signedIn: boolean): 'loading' | 'signup' | 'product' {
  if (!ready) return 'loading';
  return signedIn ? 'product' : 'signup';
}
/** A signed-out visitor may watch a video listing (the Shorts viewer); its details, buying and everything else still ask them to sign in. */
export function guestMayWatch(post: { video?: unknown } | null | undefined): boolean {
  return Boolean(post && post.video);
}
