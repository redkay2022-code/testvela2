export type SellerApprovalState = { roles: string[]; application: { status: string } | null };

/** Presentation only: a trusted server account result must confirm the role. */
export function shouldOpenSellerDashboard(account: SellerApprovalState | undefined, previousSeller: boolean | null, pathname: string, applying: boolean) {
  if (!account || account.roles.includes('admin') || !account.roles.includes('seller') || account.application?.status !== 'approved' || pathname === '/seller') return false;
  return previousSeller === false || (previousSeller === null && (pathname === '/me' || pathname === '/' || applying));
}