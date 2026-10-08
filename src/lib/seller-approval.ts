import { sellerTier, type SellerReputation } from './reputation';

export type SellerApprovalState = { roles: string[]; application: { status: string } | null };

/** Navigation presentation only; uploading remains protected by server policies. */
export function accountUploadRole(account: Pick<SellerApprovalState, 'roles'> | undefined) {
  if (account?.roles.includes('seller')) return 'seller' as const;
  if (account?.roles.includes('admin')) return 'admin' as const;
  return null;
}

/** Presentation only: a trusted server account result must confirm the role. */
export function shouldOpenSellerDashboard(account: SellerApprovalState | undefined, previousSeller: boolean | null, pathname: string, applying: boolean) {
  if (!account || account.roles.includes('admin') || !account.roles.includes('seller') || account.application?.status !== 'approved' || pathname === '/seller') return false;
  return previousSeller === false || (previousSeller === null && (pathname === '/me' || pathname === '/' || applying));
}

/** Badge presentation uses the trusted account role, never URL preview state. */
export function accountSellerTier(account: Pick<SellerApprovalState, 'roles'> | undefined, reputation?: SellerReputation) {
  if (!account?.roles.includes('seller')) return null;
  return reputation && !reputation.sample ? sellerTier(reputation) ?? 'standard' : 'standard';
}
