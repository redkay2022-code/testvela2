/** Wait for session hydration before deciding whether product access needs signup. */
export function productEntry(ready: boolean, signedIn: boolean): 'loading' | 'signup' | 'product' {
  if (!ready) return 'loading';
  return signedIn ? 'product' : 'signup';
}