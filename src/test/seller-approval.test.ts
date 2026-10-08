import { describe, expect, it } from 'vitest';
import { accountSellerTier, shouldOpenSellerDashboard } from '@/lib/seller-approval';

describe('seller approval dashboard navigation', () => {
  const approved = { roles: ['seller'], application: { status: 'approved' } };
  it('opens the dashboard when a pending member becomes an approved seller', () => {
    expect(shouldOpenSellerDashboard(approved, false, '/me', true)).toBe(true);
  });
  it('does not accept an approval without the trusted seller role', () => {
    expect(shouldOpenSellerDashboard({ ...approved, roles: ['user'] }, false, '/me', true)).toBe(false);
  });
  it('does not move an administrator away from the admin dashboard', () => {
    expect(shouldOpenSellerDashboard({ ...approved, roles: ['admin', 'seller'] }, false, '/admin', false)).toBe(false);
  });
  it('opens the dashboard after returning to the platform following approval', () => {
    expect(shouldOpenSellerDashboard(approved, null, '/', false)).toBe(true);
  });
  it('allows an existing seller to browse without a redirect loop', () => {
    expect(shouldOpenSellerDashboard(approved, true, '/market', false)).toBe(false);
    expect(shouldOpenSellerDashboard(approved, false, '/seller', false)).toBe(false);
  });
  it('keeps pending applications on the current page', () => {
    expect(shouldOpenSellerDashboard({ roles: ['user'], application: { status: 'pending' } }, false, '/me', true)).toBe(false);
  });
});

describe('approved seller profile badge', () => {
  it('switches from buyer to STANDARD as soon as the trusted seller role arrives', () => {
    expect(accountSellerTier({ roles: ['user'] })).toBeNull();
    expect(accountSellerTier({ roles: ['user', 'seller'] })).toBe('standard');
  });
  it('does not turn a pending customer or admin into a seller', () => {
    expect(accountSellerTier(undefined)).toBeNull();
    expect(accountSellerTier({ roles: ['admin'] })).toBeNull();
  });
  it('uses an earned or administrator-assigned live seller tier', () => {
    expect(accountSellerTier({ roles: ['seller'] }, { approved: true, ratings: null, completedSales: 0, override: 'master' })).toBe('master');
  });
  it('never promotes a real account using sample reputation', () => {
    expect(accountSellerTier({ roles: ['seller'] }, { approved: true, ratings: null, completedSales: 0, override: 'master', sample: true })).toBe('standard');
  });
});
