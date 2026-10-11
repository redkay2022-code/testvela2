import { describe, expect, it } from 'vitest';
import { accountPage, accountSellerTier, accountUploadRole, shouldOpenSellerDashboard } from '@/lib/seller-approval';

describe('trusted account page', () => {
  it('always opens the seller dashboard for a trusted seller', () => {
    expect(accountPage({ roles: ['user', 'seller'] })).toBe('/seller');
    expect(accountPage({ roles: ['admin', 'seller'] })).toBe('/seller');
  });
  it('keeps customers, pending users and guests on My VELA', () => {
    expect(accountPage({ roles: ['user'] })).toBe('/me');
    expect(accountPage(undefined)).toBe('/me');
  });
});

describe('account center navigation', () => {
  it('switches to product upload as soon as the trusted seller role is granted', () => {
    expect(accountUploadRole({roles:['user']})).toBeNull();
    expect(accountUploadRole({roles:['user','seller']})).toBe('seller');
  });
  it('keeps the cart for guests and pending customers', () => {
    expect(accountUploadRole(undefined)).toBeNull();
    expect(accountUploadRole({roles:['user']})).toBeNull();
  });
  it('retains product upload for trusted administrators', () => {
    expect(accountUploadRole({roles:['admin']})).toBe('admin');
  });
});

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

import { ratingDowngradeAlert } from '@/lib/reputation';
describe('rating downgrade alert', () => {
  const base = { approved: true, ratings: null, completedSales: 60, volumeUsd: 60000, disputeRate: 0.5 } as const;
  it('alerts PRIME seller whose rating drops below 4.8', () => {
    expect(ratingDowngradeAlert({ ...base, ratingAvg: 4.6 })).toMatchObject({ tier: 'prime', required: 4.8, fallback: 'pro' });
  });
  it('no alert when rating meets PRIME 4.8', () => {
    expect(ratingDowngradeAlert({ ...base, ratingAvg: 4.85 })).toBeNull();
  });
  it('PRO requires 4.5', () => {
    expect(ratingDowngradeAlert({ ...base, completedSales: 20, volumeUsd: 20000, ratingAvg: 4.4 })).toMatchObject({ tier: 'pro', required: 4.5, fallback: 'standard' });
  });
});
